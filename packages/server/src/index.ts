import { initTRPC } from "@trpc/server";
import { JsonService } from "#core/core/services/JsonService.ts";
import type { ApiContext } from "#server/core/utils/ApiContext.ts";

const trpc = initTRPC.context<ApiContext>().create({
	transformer: JsonService.transformer,
});

export const router = trpc.router;
export const procedure = trpc.procedure;
