import type { Memory } from "../../../../../server/generated/prisma/browser.ts";

export {
	MemoryCategory,
	MemoryStability,
} from "../../../../../server/generated/prisma/browser.ts";

export type MemoryState = Memory;

export type MemorySearchResult = Pick<
	MemoryState,
	"id" | "fact" | "category" | "stability" | "createdAt"
>;
