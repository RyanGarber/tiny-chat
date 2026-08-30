import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import type { ChatLike } from "@tiny-chat/core/src/features/data/types/chat.ts";
import {
	Author,
	type MessageLike,
	type zConfig,
	type zData,
	type zMetadata,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import {
	type MessageBranches,
	MessageBranchUtils,
} from "@tiny-chat/core/src/features/data/utils/MessageBranchUtils.ts";
import { MemoryRetrievalService } from "../../chat/services/MemoryRetrievalService.ts";
import { MessageUtils } from "../utils/MessageUtils.ts";

const idOf = (value: MessageLike) =>
	typeof value === "string" ? value : value.id;
type Content = {
	author: Author;
	config: zConfig;
	data: zData;
	metadata: zMetadata;
};
const requireRow = <T>(row: T | null | undefined): T => {
	if (!row) throw new Error("Message or chat not found");
	return row;
};

export const MessageService = {
	getMessage: async ({
		user,
		message,
	}: {
		user: zUser;
		message: MessageLike;
	}) =>
		MessageUtils.toMessageState(
			requireRow(
				await globalThis.db.orm.public.Message.where({
					userId: user.id,
					id: idOf(message),
				}).first(),
			),
		),

	/** Fetch the topology once, then only the selected page's content. */
	getMessages: async ({
		user,
		chat,
		limit,
		cursor,
		omit,
		start,
		branches = {},
	}: {
		user: zUser;
		chat: ChatLike;
		limit?: number;
		cursor?: string;
		omit?: boolean;
		start?: string;
		branches?: MessageBranches;
	}) => {
		const query = globalThis.db.orm.public.Message.where({
			chatId: idOf(chat),
			userId: user.id,
		});
		const topology = (
			await query.select("id", "previousId", "createdAt").all()
		).map((m) => ({ ...m, createdAt: CommonUtils.toDate(m.createdAt) }));
		const path = MessageBranchUtils.getBranch(topology, start, branches);
		const index = cursor ? path.findIndex((m) => m.id === cursor) : path.length;
		const end = index < 0 ? path.length : index;
		const from = limit ? Math.max(0, end - limit) : 0;
		const page = path.slice(from, end);
		const siblings = MessageBranchUtils.index(topology).children;
		const branchOptions = Object.fromEntries(
			page.map((m) => [
				m.id,
				(siblings.get(m.previousId) ?? []).map((s) => s.id),
			]),
		);
		if (!page.length) return { messages: [], nextCursor: null, branchOptions };
		const selected = query.where((m) => m.id.in(page.map((m) => m.id)));
		const rows = omit
			? await selected
					.select(
						"id",
						"userId",
						"chatId",
						"previousId",
						"author",
						"config",
						"data",
						"createdAt",
					)
					.all()
			: await selected.all();
		const byId = new Map(
			MessageUtils.toMessageStates(rows).map((m) => [m.id, m]),
		);
		return {
			messages: page.map((m) => requireRow(byId.get(m.id) ?? null)),
			nextCursor: from > 0 ? path[from].id : null,
			branchOptions,
		};
	},

	/** Add a child without moving any of the parent's existing branches. */
	createMessage: async ({
		user,
		chat,
		folderId,
		previous,
		temporary,
		incognito,
		...content
	}: Content & {
		user: zUser;
		chat?: ChatLike | null;
		folderId?: string | null;
		previous?: MessageLike | null;
		temporary?: boolean;
		incognito?: boolean;
	}) => {
		const retrieval =
			!chat && !incognito
				? await MemoryRetrievalService.build({
						user,
						text: DataUtils.getText(content),
					})
				: { memories: [], embedding: undefined };
		return globalThis.db.transaction(async (tx) => {
			let chatId = chat ? idOf(chat) : undefined;
			let previousId = previous ? idOf(previous) : null;
			if (chatId) {
				const existing = requireRow(
					await tx.orm.public.Chat.where({
						id: chatId,
						userId: user.id,
					}).first(),
				);
				if (temporary && !existing.temporary)
					throw new Error("Chat cannot be made temporary");
				if (incognito && !existing.incognito)
					throw new Error("Chat cannot be made incognito");
				if (previousId) {
					requireRow(
						await tx.orm.public.Message.where({
							id: previousId,
							chatId,
							userId: user.id,
						})
							.select("id")
							.first(),
					);
				} else if (previous === undefined) {
					const rows = await tx.orm.public.Message.where({
						chatId,
						userId: user.id,
					})
						.select("id", "previousId", "createdAt")
						.all();
					previousId =
						MessageBranchUtils.getBranch(
							rows.map((m) => ({
								...m,
								createdAt: CommonUtils.toDate(m.createdAt),
							})),
						).at(-1)?.id ?? null;
				}
			} else {
				if (previousId) throw new Error("A parent requires a chat");
				chatId = CommonUtils.getRandomId();
				if (folderId)
					requireRow(
						await tx.orm.public.Folder.where({
							id: folderId,
							userId: user.id,
						}).first(),
					);
				await tx.orm.public.Chat.create({
					id: chatId,
					userId: user.id,
					folderId: folderId ?? null,
					title: null,
					temporary: temporary ?? false,
					incognito: incognito ?? false,
					memories: (Memory) =>
						Memory.connect(retrieval.memories.map(({ id }) => ({ id }))),
				});
			}
			const created = await tx.orm.public.Message.create({
				...content,
				id: CommonUtils.getRandomId(),
				userId: user.id,
				chatId,
				previousId,
			});
			if (retrieval.embedding)
				await tx.execute(
					globalThis.db.raw.sql`
				UPDATE message SET embedding = ${JSON.stringify(retrieval.embedding)}::vector
				WHERE id = ${created.id} AND "userId" = ${user.id}
			`
						.affectedCount()
						.build(),
				);
			return MessageUtils.toMessageState(created);
		});
	},

	/** An edit is a sibling. Retaining newer messages clones the entire subtree. */
	editMessage: async ({
		user,
		message,
		truncate = false,
		...content
	}: Content & {
		user: zUser;
		message: MessageLike;
		truncate?: boolean;
	}) =>
		globalThis.db.transaction(async (tx) => {
			const existing = requireRow(
				await tx.orm.public.Message.where({
					id: idOf(message),
					userId: user.id,
				}).first(),
			);
			const edited = await tx.orm.public.Message.create({
				...content,
				id: CommonUtils.getRandomId(),
				userId: user.id,
				chatId: existing.chatId,
				previousId: existing.previousId,
			});
			if (!truncate) {
				const query = tx.orm.public.Message.where({
					chatId: existing.chatId,
					userId: user.id,
				});
				const topology = await query
					.select("id", "previousId", "createdAt")
					.all();
				const descendants = MessageBranchUtils.getDescendants(
					topology.map((m) => ({
						...m,
						createdAt: CommonUtils.toDate(m.createdAt),
					})),
					existing.id,
				);
				const rows = descendants.length
					? await query
							.where((m) => m.id.in(descendants.map((m) => m.id)))
							.all()
					: [];
				const rawById = new Map(rows.map((m) => [m.id, m]));
				const cloneIds = descendants
					.map(() => CommonUtils.getRandomId())
					.sort((a, b) => a.localeCompare(b));
				const ids = new Map([
					[existing.id, edited.id],
					...descendants.map((m, i) => [m.id, cloneIds[i]] as const),
				]);
				if (descendants.length)
					await tx.orm.public.Message.createAll(
						descendants.map((m) => {
							const row = requireRow(rawById.get(m.id));
							return {
								...row,
								id: requireRow(ids.get(m.id)),
								previousId: requireRow(ids.get(requireRow(m.previousId))),
							};
						}),
					);
			}
			return MessageUtils.toMessageState(edited);
		}),

	/** In-place writes are reserved for generation/feedback, never user edits. */
	updateMessage: async ({
		user,
		message,
		truncate: _truncate,
		...content
	}: Content & {
		user: zUser;
		message: MessageLike;
		truncate?: boolean;
	}) =>
		globalThis.db.transaction(async (tx) => {
			const query = tx.orm.public.Message.where({
				id: idOf(message),
				userId: user.id,
			});
			const existing = MessageUtils.toMessageState(
				requireRow(await query.first()),
			);
			const updated = requireRow(await query.update(content));
			if (DataUtils.getText(existing) !== DataUtils.getText(content)) {
				await tx.execute(
					globalThis.db.raw
						.sql`UPDATE message SET embedding = NULL WHERE id = ${updated.id} AND "userId" = ${user.id}`
						.affectedCount()
						.build(),
				);
			}
			return MessageUtils.toMessageState(updated);
		}),

	/** Delete only this turn. Shared prompts and sibling branches survive. */
	deleteMessage: async ({
		user,
		message,
	}: {
		user: zUser;
		message: MessageLike;
	}) =>
		globalThis.db.transaction(async (tx) => {
			const existing = requireRow(
				await tx.orm.public.Message.where({
					id: idOf(message),
					userId: user.id,
				}).first(),
			);
			const rows = await tx.orm.public.Message.where({
				chatId: existing.chatId,
				userId: user.id,
			})
				.select("id", "previousId", "author")
				.all();
			const deleted = new Set([existing.id]);
			let parentId = existing.previousId;
			if (existing.author === Author.MODEL && parentId) {
				const parent = rows.find((m) => m.id === parentId);
				if (
					parent?.author === Author.USER &&
					rows.filter((m) => m.previousId === parentId).length === 1
				) {
					deleted.add(parent.id);
					parentId = parent.previousId;
				}
			} else if (existing.author === Author.USER) {
				for (const child of rows.filter(
					(m) => m.previousId === existing.id && m.author === Author.MODEL,
				))
					deleted.add(child.id);
			}
			await tx.orm.public.Message.where({
				userId: user.id,
				chatId: existing.chatId,
			})
				.where((m) => m.previousId.in([...deleted]))
				.updateAll({ previousId: parentId });
			await tx.orm.public.DreamMessage.where((link) =>
				link.messageId.in([...deleted]),
			).deleteAll();
			await tx.orm.public.Message.where({
				userId: user.id,
				chatId: existing.chatId,
			})
				.where((m) => m.id.in([...deleted]))
				.deleteAll();
			if (rows.length === deleted.size) {
				await tx.orm.public.ChatMemory.where({
					chatId: existing.chatId,
				}).deleteAll();
				await tx.orm.public.Chat.where({
					id: existing.chatId,
					userId: user.id,
				}).delete();
				return true;
			}
			return false;
		}),
} as const;
