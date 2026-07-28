import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { tRPCContext } from "./core/services/tRPCService.ts";

const tRPC = initTRPC.context<tRPCContext>().create({
	transformer: superjson,
});

export const router = tRPC.router;
export const procedure = tRPC.procedure;
