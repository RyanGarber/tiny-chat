import "./src/env.ts";

import paradedb from "@prisma/orm-extension-paradedb/control";
import pgvector from "@prisma/orm-extension-pgvector/control";
import { defineConfig as definePostgresConfig } from "@prisma/orm-postgres/config";
import { zod } from "@tiny-chat/core/prisma/zod-extension.ts";
import { definePrismaConfig } from "prisma/config";

export default definePrismaConfig({
	orm: definePostgresConfig({
		contract: "../core/prisma/contract.prisma",
		output: "../core/generated/prisma",
		migrations: {
			dir: "../core/prisma/migrations",
		},
		db: {
			connection: `postgres://${process.env.PG_USER}:${process.env.PG_PASSWORD}@${process.env.PG_HOST}:${process.env.PG_PORT}/${process.env.PG_DATABASE}?schema=public&connection_limit=5&pool_timeout=100&socket_timeout=100`,
		},
		extensions: [paradedb, pgvector, zod.control],
	}),
});
