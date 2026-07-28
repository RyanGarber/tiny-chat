import type { MessageLike } from "@tiny-chat/shared/src/features/data/types/message.ts";
import type { zUser } from "@tiny-chat/shared/src/features/data/types/user.ts";
import { DataUtils } from "@tiny-chat/shared/src/features/data/utils/DataUtils.ts";
import { Prisma } from "../../../../generated/prisma/client.ts";
import { UploadUtils } from "../../upload/utils/UploadUtils.ts";

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

		const embedding = (
			await globalThis.prisma.$queryRaw<
				{ embedding: string }[]
			>`SELECT embedding FROM message WHERE id = ${message.id} AND "userId" = ${user.id}`
		)[0]?.embedding;

		return embedding ? (JSON.parse(embedding) as number[]) : null;
	},

	getMissingEmbeddings: async ({
		user,
		limit,
	}: {
		user: zUser;
		limit?: number;
	}) => {
		const messages = await globalThis.prisma.$queryRaw<
			{ id: string; data: any; total: number }[]
		>`SELECT id, data, COUNT(*) OVER() as total
        FROM message
        WHERE "userId" = ${user.id}
          AND LENGTH((
            SELECT string_agg("dataPart"->>'value', ' ')
            FROM jsonb_array_elements("data") AS "step",
                 jsonb_array_elements("step") AS "dataPart"
            WHERE "dataPart"->>'type' = 'text'
          )) > 0
          AND embedding IS NULL
        ${limit ? Prisma.sql`LIMIT ${limit}` : Prisma.empty}`;

		let actions: { id: string; data: any; total: number }[] = [];
		if (!limit || messages.length < limit) {
			actions = await globalThis.prisma.$queryRaw<
				{ id: string; data: any; total: number }[]
			>`SELECT id, data, COUNT(*) OVER() as total
        FROM action
        WHERE "userId" = ${user.id}
          AND LENGTH((
            SELECT string_agg("dataPart"->>'value', ' ')
            FROM jsonb_array_elements("data") AS "step",
                 jsonb_array_elements("step") AS "dataPart"
            WHERE "dataPart"->>'type' = 'text'
          )) > 0
          AND embedding IS NULL
        ${limit ? Prisma.sql`LIMIT ${limit - messages.length}` : Prisma.empty}`;
		}

		let memories: { id: string; fact: string; total: number }[] = [];
		if (!limit || messages.length + actions.length < limit) {
			memories = await globalThis.prisma.$queryRaw<
				typeof memories
			>`SELECT id, fact, COUNT(*) OVER() as total
          FROM memory
          WHERE "userId" = ${user.id}
            AND LENGTH(fact) > 0
            AND embedding IS NULL
          ${limit ? Prisma.sql`LIMIT ${limit - messages.length - actions.length}` : Prisma.empty}`;
		}

		let files: { id: string; data: Uint8Array; total: number }[] = [];
		if (!limit || messages.length + actions.length + memories.length < limit) {
			files = await globalThis.prisma.$queryRaw<
				typeof files
			>`SELECT id, data, COUNT(*) OVER() as total
          FROM file
          WHERE "userId" = ${user.id}
            AND ${UploadUtils.shouldIncludeFileSql({})}
            AND try_decode_utf8(data) IS NOT NULL
            AND embedding IS NULL
          ${limit ? Prisma.sql`LIMIT ${limit - messages.length - actions.length - memories.length}` : Prisma.empty}`;
		}

		if (
			!messages.length &&
			!actions.length &&
			!memories.length &&
			!files.length
		)
			return null;

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
			files: files.map((f) => ({
				...f,
				text: new TextDecoder().decode(f.data),
			})),
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
		await globalThis.prisma.$transaction(
			embeddings.map(({ type, id, embedding }) => {
				return globalThis.prisma.$executeRaw`
					UPDATE ${Prisma.raw(type)}
					SET embedding = ${JSON.stringify(embedding)}::vector
					WHERE id = ${id}
					AND "userId" = ${user.id}`;
			}),
		);
	},

	resetAllEmbeddings: async ({ user }: { user: zUser }) => {
		await globalThis.prisma.$transaction([
			globalThis.prisma.$executeRaw`UPDATE message
                           SET embedding = NULL
                           WHERE "userId" = ${user.id}`,
			globalThis.prisma.$executeRaw`UPDATE action
                           SET embedding = NULL
                           WHERE "userId" = ${user.id}`,
			globalThis.prisma.$executeRaw`UPDATE memory
                           SET embedding = NULL
                           WHERE "userId" = ${user.id}`,
			globalThis.prisma.$executeRaw`UPDATE file
                           SET embedding = NULL
                           WHERE "userId" = ${user.id}`,
		]);
	},
};
