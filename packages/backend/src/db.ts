import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import config from "../prisma.config.ts";

declare global {
	var prisma: PrismaClient;
}

// biome-ignore lint/suspicious/noRedeclare: definition
export const prisma = new PrismaClient({
	adapter: new PrismaPg({ connectionString: config.datasource?.url }),
});
globalThis.prisma = prisma;
