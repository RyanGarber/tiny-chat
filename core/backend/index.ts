import {initTRPC} from "@trpc/server";
import {type tRPCContext} from "./server.ts";
import superjson from "superjson";

const trpc = initTRPC.context<tRPCContext>().create({
    transformer: superjson,
});

export const router = trpc.router;
export const procedure = trpc.procedure;
