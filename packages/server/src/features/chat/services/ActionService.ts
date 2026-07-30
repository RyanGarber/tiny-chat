import { createId } from "@paralleldrive/cuid2";
import type {
	MessageLike,
	zData,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { MessageService } from "../../message/services/MessageService.ts";
import { ActionUtils } from "../utils/ActionUtils.ts";
import { ChatService } from "./ChatService.ts";

export const ActionService = {
	getActions: async ({ user }: { user: zUser }) => {
		return (
			await globalThis.prisma.action.findMany({
				where: { userId: user.id },
			})
		).map(ActionUtils.toActionState);
	},

	createAction: async ({
		user,
		message,
		schedule,
		timezone,
		data,
	}: {
		user: zUser;
		message: MessageLike;
		schedule: string;
		timezone: string;
		data: zData;
	}) => {
		if (typeof message === "string") message = { id: message };

		const { id: chatId, folderId } = await ChatService.getChat({
			user,
			chat: message,
		});
		const { config } = await MessageService.getMessage({ user, message });

		return ActionUtils.toActionState(
			await globalThis.prisma.action.create({
				data: {
					id: createId(),
					user: { connect: { id: user.id } },
					folder: { connect: { id: folderId } },
					message: { connect: { id: message.id } },
					chat: { connect: { id: chatId } },
					config,
					schedule,
					timezone,
					data,
				},
			}),
		);
	},

	updateAction: async ({
		id,
		user,
		message,
		schedule,
		timezone,
		data,
	}: {
		id: string;
		user: zUser;
		message: MessageLike;
		schedule: string;
		timezone: string;
		data: zData;
	}) => {
		if (typeof message === "string") message = { id: message };

		const { id: chatId, folderId } = await ChatService.getChat({
			user,
			chat: message,
		});
		const { config } = await MessageService.getMessage({ user, message });

		return ActionUtils.toActionState(
			await globalThis.prisma.action.update({
				where: { id, userId: user.id },
				data: {
					message: { connect: { id: message.id } },
					folder: { connect: { id: folderId } },
					chat: { connect: { id: chatId } },
					config,
					schedule,
					timezone,
					data,
				},
			}),
		);
	},

	deleteAction: async ({ user, id }: { user: zUser; id: string }) => {
		return ActionUtils.toActionState(
			await globalThis.prisma.action.delete({
				where: { id, userId: user.id },
			}),
		);
	},
} as const;
