import { createId } from "@paralleldrive/cuid2";
import type { ChatLike } from "@tiny-chat/core/src/features/data/types/chat.ts";
import type {
	MessageLike,
	zConfig,
	zData,
	zMetadata,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import type { Message } from "../../../../generated/prisma/client.ts";
import { Author } from "../../../../generated/prisma/enums.ts";
import type { MessageCreateInput } from "../../../../generated/prisma/models/Message.ts";
import { ChatService } from "../../chat/services/ChatService.ts";
import { MessageUtils } from "../utils/MessageUtils.ts";

export const MessageService = {
	getMessage: async ({
		user,
		message,
	}: {
		user: zUser;
		message: MessageLike;
	}) => {
		if (typeof message === "string") message = { id: message };

		return MessageUtils.toMessageState(
			await globalThis.prisma.message.findFirstOrThrow({
				where: { userId: user.id, id: message.id },
			}),
		);
	},

	/**
	 * Get the messages in a chat.
	 */
	getMessages: async ({
		user,
		chat,
		limit,
		cursor,
		omit,
	}: {
		user: zUser;
		chat: ChatLike;
		limit?: number;
		cursor?: string;
		omit?: boolean;
	}) => {
		if (typeof chat === "string") chat = { id: chat };

		const messages = MessageUtils.toMessageStates(
			await globalThis.prisma.message.findMany({
				where: { chatId: chat.id, userId: user.id },
				omit: omit ? { metadata: true } : {},
			}),
		);

		if (limit) {
			const index = cursor
				? messages.findIndex((m) => m.id === cursor)
				: messages.length;

			const start = Math.max(0, index - limit);
			const slice = messages.slice(start, index);

			const nextCursor = start > 0 ? messages[start].id : null;
			return { messages: slice, nextCursor };
		}

		return { messages, nextCursor: null };
	},

	/**
	 * Create a message at a given position in a chat, creating a chat if needed.
	 */
	createMessage: async ({
		user,
		chat,
		author,
		config,
		data,
		metadata,
		previous,
		temporary,
		incognito,
	}: {
		user: zUser;
		chat?: ChatLike | null;
		author: Author;
		config: zConfig;
		data: zData;
		metadata: zMetadata;
		previous?: MessageLike | null;
		temporary?: boolean;
		incognito?: boolean;
	}) => {
		if (typeof chat === "string") chat = { id: chat };
		if (typeof previous === "string") previous = { id: previous };

		const toCreate: Partial<MessageCreateInput> = {
			id: createId(),
			user: { connect: { id: user.id } },
			author,
			config,
			data,
			metadata,
		};

		let message: Message;

		if (chat?.id) {
			const existingChat = await ChatService.getChat({ user, chat });

			if (temporary && !existingChat.temporary)
				throw new Error("Chat cannot be made temporary");
			if (incognito && !existingChat.incognito)
				throw new Error("Chat cannot be made incognito");

			toCreate.chat = { connect: { id: existingChat.id } };
			toCreate.folder = { connect: { id: existingChat.folderId } };
			toCreate.previous = {
				connect:
					previous ??
					(await prisma.message.findFirstOrThrow({
						where: { chat, next: null },
						select: { id: true },
					})),
			};

			message = await globalThis.prisma.$transaction(async (tx) => {
				if (previous) {
					await globalThis.prisma.message.updateMany({
						where: { previousId: previous.id },
						data: { previousId: null },
					});
				}

				const message = await tx.message.create({
					data: toCreate as MessageCreateInput,
				});

				if (previous) {
					await tx.message.updateMany({
						where: {
							AND: [{ previousId: previous.id }, { NOT: { id: toCreate.id } }],
						},
						data: { previousId: message.id },
					});
				}

				return message;
			});
		} else {
			message = await ChatService.createChat({
				user,
				temporary,
				incognito,
				message: toCreate as MessageCreateInput,
			});
		}

		return MessageUtils.toMessageState(message);
	},

	/**
	 * Updates a message in-place, optionally deleting all messages sent after it.
	 */
	updateMessage: async ({
		user,
		message,
		author,
		config,
		data,
		metadata,
		truncate,
	}: {
		user: zUser;
		message: MessageLike;
		author: Author;
		config: zConfig;
		data: zData;
		metadata: zMetadata;
		truncate?: boolean;
	}) => {
		if (typeof message === "string") message = { id: message };

		const existing = await MessageService.getMessage({ user, message });
		const hasTextChange =
			DataUtils.getText(existing) !== DataUtils.getText({ data });

		if (truncate) {
			const toDelete: string[] = [];

			let previousId = message.id;
			while (true) {
				const next = await globalThis.prisma.message.findFirst({
					where: { previousId },
				});
				if (!next) break;
				toDelete.push(next.id);
				previousId = next.id;
			}

			await globalThis.prisma.message.deleteMany({
				where: { id: { in: toDelete } },
			});
		}

		const updated = await globalThis.prisma.message.update({
			where: { id: message.id },
			data: {
				author,
				config,
				data,
				metadata,
				createdAt: new Date(),
			},
		});

		if (hasTextChange) {
			await globalThis.prisma
				.$executeRaw`UPDATE message SET embedding = NULL WHERE id = ${updated.id}`;
		}

		return MessageUtils.toMessageState(updated);
	},

	/**
	 * Delete a message, as well as its chat and folder if they would become empty.
	 * @returns True if a chat or folder has been deleted.
	 */
	deleteMessage: async ({
		user,
		message,
	}: {
		user: zUser;
		message: MessageLike;
	}) => {
		if (typeof message === "string") message = { id: message };

		const existing = await globalThis.prisma.message.findUniqueOrThrow({
			where: { id: message.id, userId: user.id },
			include: {
				previous: { select: { id: true, previous: { select: { id: true } } } },
				next: { select: { id: true, next: { select: { id: true } } } },
				folder: {
					select: { _count: { select: { chats: true, messages: true } } },
				},
				chat: { select: { _count: { select: { messages: true } } } },
			},
		});

		const where = { OR: [{ id: message.id }] };

		let linkPrevious = existing.previous?.id;
		let linkNext = existing.next?.id;

		if (existing.previous && existing.author === Author.MODEL) {
			where.OR.push({ id: existing.previous.id });
			linkPrevious = existing.previous.previous?.id;
		}
		if (existing.next && existing.author === Author.USER) {
			where.OR.push({ id: existing.next.id });
			linkNext = existing.next.next?.id;
		}

		if (linkPrevious && linkNext) {
			await globalThis.prisma.message.update({
				where: { id: linkPrevious },
				data: { next: { connect: { id: linkNext } } },
			});
			await globalThis.prisma.message.update({
				where: { id: linkNext },
				data: { previous: { connect: { id: linkPrevious } } },
			});
		}

		if (existing.author === Author.USER && existing.next)
			where.OR.push({ id: existing.next.id });
		else if (existing.author === Author.MODEL && existing.previous)
			where.OR.push({ id: existing.previous.id });

		if (existing.folder._count.messages <= 2) {
			await globalThis.prisma.folder.delete({
				where: { id: existing.folderId },
			});
			return true;
		} else if (existing.chat._count.messages <= 2) {
			await globalThis.prisma.chat.delete({ where: { id: existing.chatId } });
			return true;
		}

		await globalThis.prisma.message.deleteMany({ where });

		return false;
	},
} as const;
