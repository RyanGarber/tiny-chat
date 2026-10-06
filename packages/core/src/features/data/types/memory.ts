import { z } from "zod";
import type { Model } from "#core/core/services/PostgresService.ts";
import { MessageLike } from "#core/features/data/types/message.ts";

export type MemoryState = Omit<Model["Memory"], "embedding">;

export type MemorySearchResult = Pick<
	MemoryState,
	| "id"
	| "fact"
	| "category"
	| "stability"
	| "createdAt"
	| "updatedAt"
	| "evidence"
	| "confidence"
>;

export const MemorySource = MessageLike.refine(
	(message) => typeof message === "object",
).or(z.object({ text: z.string() }));
export type MemorySource = z.infer<typeof MemorySource>;
