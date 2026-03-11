import { initTRPC } from '@trpc/server';
import { type tRPCContext } from './server.ts';
import superjson from 'superjson';
import { type PrismaClient } from '../generated/prisma/client.ts';

declare global {
  var prisma: PrismaClient;
}

const trpc = initTRPC.context<tRPCContext>().create({
  transformer: superjson,
});

export const router = trpc.router;
export const procedure = trpc.procedure;
