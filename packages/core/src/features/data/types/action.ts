import type { Model } from "#core/core/services/PostgresService.ts";
import type { zData } from "#core/features/data/types/part.ts";

export type ActionState = Omit<Model["Action"], "embedding"> & {
	chatId: string;
	data: zData;
} & {
	nextRunAt: Temporal.PlainDateTime | null;
};
