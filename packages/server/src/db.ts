import "temporal-polyfill/full/global";

import paradedb from "@prisma/orm-extension-paradedb/runtime";
import pgvector from "@prisma/orm-extension-pgvector/runtime";
import postgres from "@prisma/orm-postgres/runtime";
import type {
	Contract,
	FieldOutputTypes,
} from "@tiny-chat/core/generated/prisma/contract.d.ts";
import contractJson from "@tiny-chat/core/generated/prisma/contract.json" with {
	type: "json",
};
import { zod } from "@tiny-chat/core/prisma/zod-extension.ts";
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
