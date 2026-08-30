import "temporal-polyfill/full/global";

import { PrismaPg } from "@prisma/adapter-pg";
import postgres from "@prisma/orm-postgres/runtime";
import type {
	Contract,
	FieldOutputTypes,
} from "@tiny-chat/core/generated/prisma/contract.d.ts";
import contractJson from "@tiny-chat/core/generated/prisma/contract.json" with {
	type: "json",
};
import { PrismaClient } from "../generated/prisma/client.ts";
import config from "../prisma.config.ts";
import config7 from "../prisma7.config.ts";

declare global {
	var prisma: PrismaClient;
	var db: ReturnType<typeof postgres<Contract>>;
}

// biome-ignore lint/suspicious/noRedeclare: definition
export const prisma = new PrismaClient({
	adapter: new PrismaPg({ connectionString: config7.datasource?.url }),
});
globalThis.prisma = prisma;

// biome-ignore lint/suspicious/noRedeclare: definition
export const db = postgres<Contract>({
	url: config.orm.db?.connection as string,
	contractJson,
});
globalThis.db = db;

const columnCache = new Map<string, readonly string[]>();

function columnsOf(namespace: string, model: string): readonly string[] {
	const key = `${namespace}.${model}`;
	let columns = columnCache.get(key);
	if (!columns) {
		const fields = (contractJson as any).domain?.namespaces?.[namespace]
			?.models?.[model]?.fields;
		if (!fields)
			throw new Error(`selectAll: unknown model "${namespace}.${model}"`);
		columns = Object.freeze(Object.keys(fields));
		columnCache.set(key, columns);
	}
	return columns;
}

export function selectAll<
	NS extends keyof FieldOutputTypes,
	Model extends keyof FieldOutputTypes[NS],
	Builder extends {
		select: (...fields: (keyof FieldOutputTypes[NS][Model] & string)[]) => any;
	},
>(
	builder: Builder,
	namespace: NS,
	model: Model,
): ReturnType<Builder["select"]> {
	return builder.select(
		...(columnsOf(
			namespace as string,
			model as string,
		) as (keyof FieldOutputTypes[NS][Model] & string)[]),
	);
}
