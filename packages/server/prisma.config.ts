import "./src/env.ts";

import { defineConfig as definePostgresConfig } from "@prisma/orm-postgres/config";
import { definePrismaConfig } from "prisma/config";

export default definePrismaConfig({
	orm: definePostgresConfig({
		contract: "../core/prisma/contract.prisma",
		output: "../core/generated/prisma",
		db: {
			connection: `postgres://${process.env.PG_USER}:${process.env.PG_PASSWORD}@${process.env.PG_HOST}:${process.env.PG_PORT}/${process.env.PG_DATABASE}?schema=public&connection_limit=5&pool_timeout=0&socket_timeout=0`,
		},
	}),
});
