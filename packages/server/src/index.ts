import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { ApiContext } from "./core/ApiContext.ts";

const trpc = initTRPC.context<ApiContext>().create({
	transformer: superjson,
});

export const router = trpc.router;
export const procedure = trpc.procedure;
