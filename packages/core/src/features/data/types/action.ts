import type { Action } from "../../../../../server/generated/prisma/browser.ts";
import type { zData } from "./message.ts";

export type ActionState = Action & { chatId: string; data: zData } & {
	nextRunAt: Date | null;
};
