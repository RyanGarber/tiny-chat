import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import type { ActionState } from "@tiny-chat/core/src/features/data/types/action.ts";
import { zData } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { Action } from "../../../../generated/prisma/client.ts";

export const ActionUtils = {
	toActionState: (action: Action): ActionState => {
		return {
			...action,
			data: zData.parse(action.data),
			nextRunAt: CommonUtils.getScheduled({
				rrule: action,
				after: action.lastRanAt,
			}),
		};
	},
} as const;
