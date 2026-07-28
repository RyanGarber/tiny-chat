import type { Action } from "../../../../../backend/generated/prisma/browser.ts";

export type ActionState = Action & {
	nextRunAt: Date | null;
};
