import { z } from "zod";
import type { Model } from "../../../core/services/PostgresService.ts";
import { MessageLike } from "./message.ts";

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

export const MemorySource = MessageLike.refine(
	(message) => typeof message === "object",
).or(z.object({ text: z.string() }));
export type MemorySource = z.infer<typeof MemorySource>;
