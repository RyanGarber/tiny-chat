import { JsonService } from "@tiny-chat/core/src/core/services/JsonService.ts";
import { initTRPC } from "@trpc/server";
import type { ApiContext } from "./core/utils/ApiContext.ts";

const trpc = initTRPC.context<ApiContext>().create({
	transformer: JsonService.transformer,
});

export const router = trpc.router;
export const procedure = trpc.procedure;
