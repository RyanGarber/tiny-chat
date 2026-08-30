import { or } from "@prisma/orm-postgres/orm-client";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import type {
	ChatLike,
	ChatState,
	FolderState,
} from "@tiny-chat/core/src/features/data/types/chat.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { selectAll } from "../../../db.ts";
import { ChatUtils } from "../utils/ChatUtils.ts";

export const ChatService = {
	/**
	 * Get a chat by itself or any of its messages.
	 */
	getChat: async ({
		user,
		chat: chatLike,
	}: {
		user: zUser;
		chat: ChatLike;
	}): Promise<ChatState> => {
		if (typeof chatLike === "string") chatLike = { id: chatLike };

		const chat = await globalThis.db.orm.public.Chat.where({
			userId: user.id,
		})
			.where((chat) =>
				or(
					chat.id.eq(chatLike.id),
					chat.messages.some((message) => message.id.eq(chatLike.id)),
				),
			)
			.include("messages", (message) => message.select("createdAt"))
			.first();

		if (!chat) throw new Error(`no chat or message with id ${chatLike.id}`);

		return ChatUtils.toChatState(chat);
	},

	/**
	 * Get a user's chat list.
	 */
	createFolder: async ({ user }: { user: zUser }) => {
		return globalThis.db.orm.public.Folder.create({
			id: CommonUtils.getRandomId(),
			userId: user.id,
			title: null,
		});
	},

	getChats: async ({
		user,
		limit,
		cursor,
	}: {
		user: zUser;
		limit?: number;
		cursor?: string;
	}): Promise<{
		folders: FolderState[];
		chats: ChatState[];
		nextCursor: string | null;
	}> => {
		const [folderRows, chatRows] = await Promise.all([
			cursor
				? []
				: db.orm.public.Folder.where({ userId: user.id })
						.include("chats", (chat) =>
							selectAll(chat, "public", "Chat")
								.where({ temporary: false })
								.include("messages", (message) => message.select("createdAt")),
						)
						.orderBy((f) => f.createdAt.desc())
						.all(),
			db.orm.public.Chat.where({
				userId: user.id,
				folderId: null,
				temporary: false,
			})
				.include("messages", (message) => message.select("createdAt"))
				.all(),
		]);

		const timestamp = (chat: ChatState) => {
			return Math.max(
				chat.createdAt.toZonedDateTime("UTC").epochMilliseconds,
				...chat.messages.map(
					(message) =>
						message.createdAt.toZonedDateTime("UTC").epochMilliseconds,
				),
			);
		};

		const sortChats = (chats: ChatState[]) => {
			return chats.sort(
				(a, b) => timestamp(b) - timestamp(a) || a.id.localeCompare(b.id),
			);
		};

		const folders = folderRows.map((folder) => ({
			...folder,
			chats: sortChats(folder.chats.map(ChatUtils.toChatState)),
		}));
		const chats = sortChats(chatRows.map(ChatUtils.toChatState));

		const start = cursor
			? Math.max(
					0,
					chats.findIndex((chat) => chat.id === cursor),
				)
			: 0;
		const end = limit ? start + limit : chats.length;

		return {
			folders,
			chats: chats.slice(start, end),
			nextCursor: chats[end]?.id ?? null,
		};
	},

	/**
	 * Set the title of a chat.
	 */
	setChatTitle: async ({
		user,
		chat,
		title,
	}: {
		user: zUser;
		chat: ChatLike;
		title: string;
	}) => {
		const { id } = await ChatService.getChat({
			user,
			chat,
		});
		await globalThis.db.orm.public.Chat.where({ id }).update({ title });
	},

	/**
	 * Delete a chat, preserving its folder.
	 */
	deleteChat: async ({ user, chat }: { user: zUser; chat: ChatLike }) => {
		if (typeof chat === "string") chat = { id: chat };
		const id = chat.id;
		await globalThis.db.transaction(async (tx) => {
			const existing = await tx.orm.public.Chat.where({ userId: user.id, id })
				.select("id")
				.first();
			if (!existing) return;
			// TODO - confirm relations delete and remove this
			await tx.orm.public.ChatMemory.where({ chatId: id }).deleteAll();
			const messages = await tx.orm.public.Message.where({
				chatId: id,
				userId: user.id,
			})
				.select("id")
				.all();
			if (messages.length)
				await tx.orm.public.DreamMessage.where((link) =>
					link.messageId.in(messages.map((message) => message.id)),
				).deleteAll();
			await tx.orm.public.Chat.where({ userId: user.id, id }).delete();
		});
	},
} as const;
