import type { Model } from "../../../core/services/PostgresService.ts";

export type MemoryState = Omit<Model["Memory"], "embedding">;

export type MemorySearchResult = Pick<
	MemoryState,
	| "id"
	| "fact"
	| "category"
	| "stability"
	| "createdAt"
	| "evidence"
	| "confidence"
>;
