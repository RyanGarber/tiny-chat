import type { Model } from "@tiny-chat/core/src/core/services/PostgresService.ts";
import type { PartialBy } from "@tiny-chat/core/src/core/types/common.ts";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import type { ActionState } from "@tiny-chat/core/src/features/data/types/action.ts";

export const ActionUtils = {
	toActionState: ({
		embedding,
		...action
	}: PartialBy<Model["Action"], "embedding"> & {
		chatId: string;
	}): ActionState => {
		return {
			...action,
			nextRunAt: CommonUtils.getScheduled({
				rrule: action,
				after: action.lastRanAt,
			}),
		};
	},
} as const;
