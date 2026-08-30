import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import type { ActionState } from "@tiny-chat/core/src/features/data/types/action.ts";
import {
	zConfig,
	zData,
} from "@tiny-chat/core/src/features/data/types/message.ts";

export const ActionUtils = {
	toActionState: (
		action: Awaited<
			ReturnType<typeof globalThis.db.orm.public.Action.all>
		>[number] & { chatId: string },
	): ActionState => {
		return {
			...action,
			createdAt: CommonUtils.toDate(action.createdAt),
			lastRanAt: CommonUtils.toDate(action.lastRanAt),
			config: zConfig.parse(action.config),
			data: zData.parse(action.data),
			nextRunAt: CommonUtils.getScheduled({
				rrule: action,
				after: CommonUtils.toDate(action.lastRanAt),
			}),
		};
	},
} as const;
