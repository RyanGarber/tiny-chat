import type { Action } from "../../../../../server/generated/prisma/browser.ts";

export type ActionState = Action & {
	nextRunAt: Date | null;
};
