import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';

declare global {
  var prisma: PrismaClient;
}

export const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: `postgres://${process.env.PG_USER}:${process.env.PG_PASSWORD}@${process.env.PG_HOST}:${process.env.PG_PORT}/${process.env.PG_DATABASE}?schema=public&connection_limit=5&pool_timeout=0&socket_timeout=0`,
    idleTimeoutMillis: 2147483647,
    connectionTimeoutMillis: 10000,
    min: 1,
  }),
});

globalThis.prisma = prisma;
