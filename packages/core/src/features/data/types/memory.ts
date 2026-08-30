import type { FieldOutputTypes } from "../../../../generated/prisma/contract.d.ts";

export {
	MemoryCategory,
	MemoryStability,
} from "../../../../../server/generated/prisma/browser.ts";

export type MemoryState = FieldOutputTypes["public"]["Memory"];

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
