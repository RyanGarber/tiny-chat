import type { MessageLike } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { zData } from "@tiny-chat/core/src/features/data/types/part.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { FileExtractionService } from "@tiny-chat/core/src/features/file/services/FileExtractionService.ts";
import { FileExcludeUtils } from "@tiny-chat/core/src/features/file/utils/FileExcludeUtils.ts";
import { UploadUtils } from "../../upload/utils/UploadUtils.ts";

function total() {
	return globalThis.db.raw.sql`COUNT(*) OVER()`.returns("pg/text@1");
}

function isNull(column: any) {
	return globalThis.db.raw.sql`${column} IS NULL`.returns("pg/bool@1");
}

function isNonEmptyText(column: any) {
	return globalThis.db.raw.sql`LENGTH(${column}) > 0`.returns("pg/bool@1");
}

function isNonEmptyData(column: any) {
	return globalThis.db.raw.sql`LENGTH((
		SELECT string_agg("dataPart"->>'value', ' ')
		FROM jsonb_array_elements(${column}) AS "step",
			 jsonb_array_elements("step") AS "dataPart"
		WHERE "dataPart"->>'type' = 'text'
	)) > 0`.returns("pg/bool@1");
}

function remaining(limit: number, current: number) {
	return limit ? limit - current : undefined;
}

/**
 * Embedding management.
 */
export const EmbeddingService = {
	getMessageEmbedding: async ({
		user,
		message,
	}: {
		user: zUser;
		message?: MessageLike;
	}) => {
		if (!message) return null;

		if (typeof message === "string") message = { id: message };

		const row = await globalThis.db.orm.public.Message.where({
			userId: user.id,
			id: message.id,
		})
			.select("embedding")
			.first();
		return row?.embedding ?? null;
	},

	getMissingEmbeddings: async ({
		user,
		limit = 10,
	}: {
		user: zUser;
		limit?: number;
	}) => {
		const db = globalThis.db;
		const runtime = db.runtime();

		let messagesQuery = db.sql.public.message
			.select("id", "data")
			.select("total", total)
			.where((f, fns) =>
				fns.and(
					fns.eq(f.userId, user.id),
					isNull(f.embedding),
					isNonEmptyData(f.data),
				),
			);
		const messagesCap = remaining(limit, 0);
		if (messagesCap !== undefined)
			messagesQuery = messagesQuery.limit(messagesCap);
		const messages = await runtime.query(messagesQuery.build());

		let actions: { id: string; data: zData; total: string }[] = [];
		if (!limit || messages.length < limit) {
			let actionsQuery = db.sql.public.action
				.select("id", "data")
				.select("total", total)
				.where((f, fns) =>
					fns.and(
						fns.eq(f.userId, user.id),
						isNull(f.embedding),
						isNonEmptyData(f.data),
					),
				);
			const actionsCap = remaining(limit, messages.length);
			if (actionsCap !== undefined)
				actionsQuery = actionsQuery.limit(actionsCap);

			actions = await runtime.query(actionsQuery.build());
		}

		let memories: { id: string; fact: string; total: string }[] = [];
		if (!limit || messages.length + actions.length < limit) {
			let memoriesQuery = db.sql.public.memory
				.select("id", "fact")
				.select("total", total)
				.where((f, fns) =>
					fns.and(
						fns.eq(f.userId, user.id),
						isNonEmptyText(f.fact),
						isNull(f.embedding),
					),
				);
			const memoriesCap = remaining(limit, messages.length + actions.length);
			if (memoriesCap !== undefined)
				memoriesQuery = memoriesQuery.limit(memoriesCap);
			memories = await runtime.query(memoriesQuery.build());
		}

		let files: {
			id: string;
			path: readonly string[];
			data: Uint8Array;
			total: string;
		}[] = [];
		if (!limit || messages.length + actions.length + memories.length < limit) {
			let filesQuery = db.sql.public.file
				.select("id", "path", "data")
				.select("total", total)
				.where((f, fns) =>
					fns.and(
						fns.eq(f.userId, user.id),
						...UploadUtils.shouldIncludeFileSql(f.path),
						fns.or(
							fns.and(
								fns.raw`try_decode_utf8(${f.data}) IS NOT NULL`.returns(
									"pg/bool@1",
								),
								fns.raw`OCTET_LENGTH(${f.data}) <= ${FileExcludeUtils.maxFileBytes}`.returns(
									"pg/bool@1",
								),
							),
							fns.and(
								UploadUtils.isDocumentSql(f.path),
								fns.raw`OCTET_LENGTH(${f.data}) <= ${FileExtractionService.maxBytes}`.returns(
									"pg/bool@1",
								),
							),
						),
						isNull(f.embedding),
					),
				);
			const filesCap = remaining(
				limit,
				messages.length + actions.length + memories.length,
			);
			if (filesCap !== undefined) filesQuery = filesQuery.limit(filesCap);
			files = await runtime.query(filesQuery.build());
		}

		const filesWithText = (
			await Promise.all(
				files.map(async ({ data, ...file }) => ({
					...file,
					text: FileExtractionService.canExtract({ path: [...file.path] })
						? await FileExtractionService.extract({
								data,
								path: [...file.path],
							})
						: new TextDecoder().decode(data),
				})),
			)
		).filter((file): file is typeof file & { text: string } => !!file.text);

		return {
			messages: messages.map((message) => ({
				...message,
				text: DataUtils.getText(message),
			})),
			actions: actions.map((action) => ({
				...action,
				text: DataUtils.getText(action),
			})),
			memories: memories.map((memory) => ({ ...memory, text: memory.fact })),
			files: filesWithText.map((file) => ({ ...file, path: [...file.path] })),
		};
	},

	setEmbeddings: async ({
		user,
		embeddings,
	}: {
		user: zUser;
		embeddings: {
			type: "message" | "action" | "memory" | "file";
			id: string;
			embedding: number[];
		}[];
	}) => {
		await globalThis.db.transaction(async (tx) =>
			Promise.all(
				embeddings.map(({ type, id, embedding }) => {
					if (type === "message") {
						return tx.orm.public.Message.where({
							userId: user.id,
							id,
						}).update({ embedding });
					} else if (type === "action") {
						return tx.orm.public.Action.where({ userId: user.id, id }).update({
							embedding,
						});
					} else if (type === "memory") {
						return tx.orm.public.Memory.where({ userId: user.id, id }).update({
							embedding,
						});
					} else if (type === "file") {
						return tx.orm.public.File.where({ userId: user.id, id }).update({
							embedding,
						});
					} else {
						throw new Error("invalid row type");
					}
				}),
			),
		);
	},

	resetAllEmbeddings: async ({ user }: { user: zUser }) => {
		await globalThis.db.transaction(async (tx) =>
			Promise.all([
				tx.orm.public.Message.where({ userId: user.id }).updateAndCount({
					embedding: null,
				}),
				tx.orm.public.Memory.where({ userId: user.id }).updateAndCount({
					embedding: null,
				}),
				tx.orm.public.Action.where({ userId: user.id }).updateAndCount({
					embedding: null,
				}),
				tx.orm.public.File.where({ userId: user.id }).updateAndCount({
					embedding: null,
				}),
			]),
		);
	},
};
