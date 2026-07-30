import { createId } from "@paralleldrive/cuid2";
import type {
	ChatLike,
	ChatState,
} from "@tiny-chat/core/src/features/data/types/chat.ts";
import type { MessageLike } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import type { Folder } from "../../../../generated/prisma/client.ts";
import type {
	MessageCreateManyChatInput,
	MessageCreateWithoutChatInput,
} from "../../../../generated/prisma/models/Message.ts";
import { MessageService } from "../../message/services/MessageService.ts";
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
	}) => {
		if (typeof chatLike === "string") chatLike = { id: chatLike };

		const chat = await globalThis.prisma.chat.findFirstOrThrow({
			where: {
				userId: user.id,
				OR: [{ id: chatLike.id }, { messages: { some: { id: chatLike.id } } }],
			},
			include: {
				messages: {
					select: {
						createdAt: true,
					},
				},
				folder: {
					select: { title: true, _count: { select: { chats: true } } },
				},
			},
		});

		return ChatUtils.toChatState(chat);
	},

	/**
	 * Get a user's chat list.
	 */
	getChats: async ({
		user,
		limit,
		cursor,
	}: {
		user: zUser;
		limit?: number;
		cursor?: string;
	}): Promise<{
		folders: (Folder & { chats: ChatState[] })[];
		nextCursor: string | null;
	}> => {
		let folders = (
			await globalThis.prisma.folder.findMany({
				where: {
					userId: user.id,
					chats: { some: { temporary: false } },
				},
				include: {
					chats: {
						where: { temporary: false },
						include: {
							messages: { select: { createdAt: true } },
							folder: {
								select: { title: true, _count: { select: { chats: true } } },
							},
						},
					},
				},
			})
		).map((folder) => ({
			...folder,
			chats: folder.chats.map(ChatUtils.toChatState),
		}));

		folders
			.sort((a, b) => {
				const aLatest = Math.max(
					...a.chats.map((item) =>
						Math.max(
							item.createdAt.getTime(),
							...item.messages.map((item) => item.createdAt.getTime()),
						),
					),
				);
				const bLatest = Math.max(
					...b.chats.map((item) =>
						Math.max(
							item.createdAt.getTime(),
							...item.messages.map((item) => item.createdAt.getTime()),
						),
					),
				);
				return bLatest - aLatest;
			})
			.forEach((chat) => {
				chat.chats.sort((a, b) => {
					const aLatest = Math.max(
						a.createdAt.getTime(),
						...a.messages.map((item) => item.createdAt.getTime()),
					);
					const bLatest = Math.max(
						b.createdAt.getTime(),
						...b.messages.map((item) => item.createdAt.getTime()),
					);
					return bLatest - aLatest;
				});
			});

		if (limit) {
			const index = Math.max(
				0,
				folders.findIndex((f) => f.id === cursor),
			);
			const nextCursor =
				index + limit < folders.length ? folders[index + limit].id : null;
			folders = folders.slice(index, index + limit);
			return { folders, nextCursor };
		}

		return { folders, nextCursor: null };
	},

	/**
	 * Create a chat, as well as a folder if one doesn't exist.
	 * @returns The first message in the chat if one was created.
	 */
	createChat: async ({
		user,
		temporary,
		incognito,
		message,
	}: {
		user: zUser;
		temporary?: boolean;
		incognito?: boolean;
		message: MessageCreateWithoutChatInput;
	}) => {
		const folderId = createId();

		const folder = await globalThis.prisma.folder.create({
			data: {
				id: folderId,
				user: { connect: { id: user.id } },
				chats: {
					create: {
						id: createId(),
						user: { connect: { id: user.id } },
						temporary,
						incognito,
						...(message
							? {
									messages: {
										create: {
											...message,
											folder: { connect: { id: folderId } },
										},
									},
								}
							: {}),
					},
				},
			},
			include: { chats: { include: { messages: true } } },
		});

		return folder.chats[0].messages[0];
	},

	/**
	 * Set the title of a chat, as well as its folder if they are the same.
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
		const {
			id,
			folder,
			title: oldTitle,
		} = await ChatService.getChat({
			user,
			chat,
		});
		await globalThis.prisma.chat.update({
			where: { id },
			data: {
				title,
				...(folder.title === oldTitle ? { folder: { update: { title } } } : {}),
			},
		});
	},

	/**
	 * Clone a chat up to a given message.
	 */
	cloneChat: async ({
		user,
		chat,
		title,
		upToMessage,
	}: {
		user: zUser;
		chat: ChatLike;
		title: string;
		upToMessage: MessageLike;
	}) => {
		if (typeof upToMessage === "string") upToMessage = { id: upToMessage };

		const { folder, folderId, temporary, incognito } =
			await ChatService.getChat({ user, chat });

		if (folder._count.chats === 1) {
			await globalThis.prisma.folder.update({
				where: { id: folderId },
				data: { title },
			});
		}

		const { messages } = await MessageService.getMessages({ user, chat });

		let reachedMessage = false;
		let previousId: string | null = null;

		return globalThis.prisma.chat.create({
			data: {
				id: createId(),
				user: { connect: { id: user.id } },
				folder: { connect: { id: folderId } },
				title,
				temporary,
				incognito,
				messages: {
					createMany: {
						data: messages.flatMap((m) => {
							if (reachedMessage) return [];
							if (m.id === upToMessage.id) reachedMessage = true;

							const id = createId();
							const message = {
								id,
								userId: user.id,
								folderId,
								author: m.author,
								config: m.config,
								data: m.data,
								metadata: m.metadata,
								previousId,
							} satisfies MessageCreateManyChatInput;
							previousId = id;

							return message;
						}),
					},
				},
			},
		});
	},

	/**
	 * Delete a chat, as well as its folder if it would become empty.
	 */
	deleteChat: async ({ user, chat }: { user: zUser; chat: ChatLike }) => {
		const { id, folder, folderId } = await ChatService.getChat({ user, chat });
		if (folder._count.chats === 1)
			await globalThis.prisma.folder.delete({ where: { id: folderId } });
		else await globalThis.prisma.chat.delete({ where: { id } });
	},
} as const;
