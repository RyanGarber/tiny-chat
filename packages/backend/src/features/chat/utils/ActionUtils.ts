import { CommonUtils } from "@tiny-chat/shared/src/core/utils/CommonUtils.ts";
import type { ActionState } from "@tiny-chat/shared/src/features/data/types/action.ts";
import type { Action } from "../../../../generated/prisma/client.ts";

export const ActionUtils = {
	toActionState: (action: Action): ActionState => {
		return {
			...action,
			nextRunAt: CommonUtils.getScheduled({
				rrule: action,
				after: action.lastRanAt,
			}),
		};
	},
} as const;
