import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import {
	type MessageLike,
	zConfig,
	type zData,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { MessageService } from "../../message/services/MessageService.ts";
import { ActionUtils } from "../utils/ActionUtils.ts";

export const ActionService = {
	getActions: async ({ user }: { user: zUser }) => {
		return (
			await globalThis.db.orm.public.Action.where({ userId: user.id })
				.include("message", (message) => message.select("chatId"))
				.all()
		).map((action) =>
			ActionUtils.toActionState({ ...action, chatId: action.message.chatId }),
		);
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

		const source = await MessageService.getMessage({ user, message });
		return ActionUtils.toActionState({
			...(await globalThis.db.orm.public.Action.create({
				id: CommonUtils.getRandomId(),
				userId: user.id,
				messageId: source.id,
				config: zConfig.parse(source.config),
				schedule,
				timezone,
				data,
				lastRanAt: null,
			})),
			chatId: source.chatId,
		});
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

		const source = await MessageService.getMessage({ user, message });
		const action = await globalThis.db.orm.public.Action.where({
			id,
			userId: user.id,
		}).update({
			messageId: source.id,
			config: zConfig.parse(source.config),
			schedule,
			timezone,
			data,
		});
		if (!action) throw new Error("Action not found");
		return ActionUtils.toActionState({ ...action, chatId: source.chatId });
	},

	deleteAction: async ({ user, id }: { user: zUser; id: string }) => {
		const action = await globalThis.db.orm.public.Action.where({
			id,
			userId: user.id,
		})
			.include("message", (m) => m.select("chatId"))
			.first();
		if (!action) throw new Error("Action not found");
		await globalThis.db.orm.public.Action.where({
			id,
			userId: user.id,
		}).delete();
		return ActionUtils.toActionState({
			...action,
			chatId: action.message.chatId,
		});
	},
} as const;
