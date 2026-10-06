import type { Model } from "#core/core/services/PostgresService.ts";
import type { PartialBy } from "#core/core/types/common.ts";
import { CommonUtils } from "#core/core/utils/CommonUtils.ts";
import type { ActionState } from "#core/features/data/types/action.ts";

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
