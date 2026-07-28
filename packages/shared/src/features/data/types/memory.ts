import type { Memory } from "../../../../../backend/generated/prisma/browser.ts";

export {
	MemoryCategory,
	MemoryStability,
} from "../../../../../backend/generated/prisma/browser.ts";

export type MemoryState = Memory;

export type MemorySearchResult = Pick<
	MemoryState,
	"id" | "fact" | "category" | "stability" | "createdAt"
>;
