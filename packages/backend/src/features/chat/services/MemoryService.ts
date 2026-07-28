import { createId } from "@paralleldrive/cuid2";
import type { MessageLike } from "@tiny-chat/shared/src/features/data/types/message.ts";
import type { zUser } from "@tiny-chat/shared/src/features/data/types/user.ts";
import type {
	MemoryCategory,
	MemoryStability,
} from "../../../../generated/prisma/enums.ts";
import { MessageService } from "../../message/services/MessageService.ts";
import { MemoryUtils } from "../utils/MemoryUtils.ts";
import { ChatService } from "./ChatService.ts";

export const MemoryService = {
	getMemories: async ({ user }: { user: zUser }) => {
		return globalThis.prisma.memory.findMany({
			where: { userId: user.id },
		});
	},

	createMemory: async ({
		user,
		message,
		fact,
		category,
		stability,
		evidence,
		confidence,
	}: {
		user: zUser;
		message?: MessageLike | null;
		fact: string;
		category: MemoryCategory;
		stability: MemoryStability;
		evidence: string[];
		confidence: number;
	}) => {
		if (typeof message === "string") message = { id: message };

		const { id: chatId, folderId } = message
			? await ChatService.getChat({ user, chat: message })
			: { id: undefined, folderId: undefined };
		const { config } = message
			? await MessageService.getMessage({ user, message })
			: { config: undefined };

		return MemoryUtils.toMemoryState(
			await globalThis.prisma.memory.create({
				data: {
					id: createId(),
					user: { connect: { id: user.id } },
					message: { connect: { id: message?.id } },
					folder: { connect: { id: folderId } },
					chat: { connect: { id: chatId } },
					config,
					fact,
					category,
					stability,
					evidence,
					confidence,
				},
			}),
		);
	},

	updateMemory: async ({
		id,
		user,
		message,
		fact,
		category,
		stability,
		evidence,
		confidence,
	}: {
		id: string;
		user: zUser;
		message?: MessageLike | null;
		fact: string;
		category: MemoryCategory;
		stability: MemoryStability;
		evidence: string[];
		confidence: number;
	}) => {
		if (typeof message === "string") message = { id: message };

		const { id: chatId, folderId } = message
			? await ChatService.getChat({ user, chat: message })
			: { id: undefined, folderId: undefined };
		const { config } = message
			? await MessageService.getMessage({ user, message })
			: { config: undefined };

		return MemoryUtils.toMemoryState(
			await globalThis.prisma.memory.update({
				where: { id, userId: user.id },
				data: {
					folder: { connect: { id: folderId } },
					chat: { connect: { id: chatId } },
					message: { connect: { id: message?.id } },
					config,
					fact,
					category,
					stability,
					evidence,
					confidence,
				},
			}),
		);
	},

	deleteMemory: async ({ user, id }: { user: zUser; id: string }) => {
		return MemoryUtils.toMemoryState(
			await globalThis.prisma.memory.delete({
				where: { id, userId: user.id },
			}),
		);
	},
} as const;
