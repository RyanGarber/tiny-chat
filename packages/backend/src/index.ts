import { initTRPC } from '@trpc/server';
import type { tRPCContext } from './services/api.ts';
import superjson from 'superjson';

const tRPC = initTRPC.context<tRPCContext>().create({
  transformer: superjson,
});

export const router = tRPC.router;
export const procedure = tRPC.procedure;
