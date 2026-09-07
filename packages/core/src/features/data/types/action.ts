import type { Model } from "../../../core/services/PostgresService.ts";
import type { zData } from "./part.ts";

export type ActionState = Omit<Model["Action"], "embedding"> & {
	chatId: string;
	data: zData;
} & {
	nextRunAt: Temporal.PlainDateTime | null;
};
