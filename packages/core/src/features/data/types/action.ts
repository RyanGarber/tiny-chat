import type { Action } from "../../../../../server/generated/prisma/browser.ts";
import type { zData } from "./message.ts";

export type ActionState = Action & { data: zData } & {
	nextRunAt: Date | null;
};
