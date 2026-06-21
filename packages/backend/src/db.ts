import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import config from '../prisma.config.ts';

declare global {
  var prisma: PrismaClient;
}

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: config.datasource!.url }),
});
globalThis.prisma = prisma;
