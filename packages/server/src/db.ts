import "temporal-polyfill/full/global";

import paradedb from "@prisma/orm-extension-paradedb/runtime";
import pgvector from "@prisma/orm-extension-pgvector/runtime";
import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "#core/generated/prisma/contract.d.ts";
import contractJson from "#core/generated/prisma/contract.json" with {
	type: "json",
};
import { zod } from "#core/prisma/zod-extension.ts";
import config from "../prisma.config.ts";

declare global {
	var db: ReturnType<typeof postgres<Contract>>;
}

// biome-ignore lint/suspicious/noRedeclare: definition
export const db = postgres<Contract>({
	url: config.orm.db?.connection as string,
	contractJson,
	extensions: [paradedb, pgvector, zod.runtime],
});
globalThis.db = db;
