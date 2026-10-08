import { CommonUtils } from "#core/core/utils/CommonUtils.ts";
import type { MessageLike } from "#core/features/data/types/message.ts";
import type { zData } from "#core/features/data/types/part.ts";
import type { zUser } from "#core/features/data/types/user.ts";
import { ActionUtils } from "#server/features/chat/utils/ActionUtils.ts";
import { MessageService } from "#server/features/message/services/MessageService.ts";

/**
 * A schedule as it is stored: started where it was written, in its timezone.
 * Left without a start, an RRule starts whenever it is read, so it would never
 * settle on a next run.
 */
const anchor = ({
	schedule,
	timezone,
}: {
	schedule: string;
	timezone: string;
}) => {
	const anchored = CommonUtils.parseSchedule({ text: schedule, timezone });
	if (!anchored) throw new Error(`Invalid schedule: ${schedule}`);
	return anchored;
};

export const ActionService = {
	getActions: async ({ user }: { user: zUser }) => {
		return (
			await globalThis.db.orm.public.Action.where({ userId: user.id })
				.include("message", (message) => message.select("chatId"))
				.all()
		).map((action) => {
			if (action.message === null)
				throw new Error("TODO TEMP - prisma typing bug");
			return ActionUtils.toActionState({
				...action,
				chatId: action.message.chatId,
			});
		});
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
				config: source.config,
				schedule: anchor({ schedule, timezone }),
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
			config: source.config,
			schedule: anchor({ schedule, timezone }),
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
		if (action.message === null)
			throw new Error("TODO TEMP - prisma typing bug");
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
