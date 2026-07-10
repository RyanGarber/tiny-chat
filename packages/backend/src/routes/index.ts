import { router } from "../index.ts";
import chat from "./chat.ts";
import context from "./context.ts";
import input from "./input.ts";
import message from "./message.ts";
import settings from "./settings.ts";
import user from "./user.ts";

export const tRPCRouter = router({
	chat,
	context,
	input,
	message,
	settings,
	user,
});

export type tRPCRouter = typeof tRPCRouter;
