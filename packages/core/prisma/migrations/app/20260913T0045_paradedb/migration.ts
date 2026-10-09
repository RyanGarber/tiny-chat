#!/usr/bin/env -S node
import { col, Migration, MigrationCLI } from "@prisma/orm-postgres/migration";
import type { Contract as End } from "../../snapshots/fbfd02f4ce7239d1569f5a744c4fbcdfc675786ba8aa4ff697acf28ff08ce55f/contract";
import endContract from "../../snapshots/fbfd02f4ce7239d1569f5a744c4fbcdfc675786ba8aa4ff697acf28ff08ce55f/contract.json" with {
	type: "json",
};
import type { Contract as Start } from "../../snapshots/5c58719a2256b126107251ff24dbd5f10c6ebf1f5fd15395cbdbebae7bcf6e93/contract";
import startContract from "../../snapshots/5c58719a2256b126107251ff24dbd5f10c6ebf1f5fd15395cbdbebae7bcf6e93/contract.json" with {
	type: "json",
};

export default class M extends Migration<Start, End> {
	override readonly startContractJson = startContract;
	override readonly endContractJson = endContract;

	override get operations() {
		return [
			this.addColumn({
				schema: "public",
				table: "file",
				column: col("updatedAt", "timestamp(3)", {
					codecRef: {
						codecId: "pg/timestamp-temporal@1",
						typeParams: { precision: 3 },
					},
				}),
			}),
			this.addColumn({
				schema: "public",
				table: "memory",
				column: col("updatedAt", "timestamp(3)", {
					codecRef: {
						codecId: "pg/timestamp-temporal@1",
						typeParams: { precision: 3 },
					},
				}),
			}),
			this.createIndex({
				schema: "public",
				table: "message",
				index: "message_search_idx",
				expression:
					"\"id\", (COALESCE(try_extract_text(\"data\"), '')::pdb.simple('alias=text'))",
				extras: {
					type: "paradedb",
					options: {
						key_field: "id",
					},
				},
			}),
			this.dropColumn({
				schema: "public",
				table: "message",
				column: "lexicon",
			}),
			this.createIndex({
				schema: "public",
				table: "action",
				index: "action_search_idx",
				expression:
					"\"id\", (COALESCE(try_extract_text(\"data\"), '')::pdb.simple('alias=text'))",
				extras: {
					type: "paradedb",
					options: {
						key_field: "id",
					},
				},
			}),
			this.dropColumn({
				schema: "public",
				table: "action",
				column: "lexicon",
			}),
			this.createIndex({
				schema: "public",
				table: "memory",
				index: "memory_search_idx",
				expression:
					'"id", "evidence", (COALESCE("fact", \'\')::pdb.simple(\'alias=text\'))',
				extras: {
					type: "paradedb",
					options: {
						key_field: "id",
					},
				},
			}),
			this.dropColumn({
				schema: "public",
				table: "action",
				column: "lexicon",
			}),
			this.createIndex({
				schema: "public",
				table: "file",
				index: "file_search_idx",
				expression:
					'"id", "path", (COALESCE(try_decode_utf8("data"), \'\')::pdb.simple(\'alias=text\'))',
				extras: {
					type: "paradedb",
					options: {
						key_field: "id",
					},
				},
			}),
			this.dropColumn({
				schema: "public",
				table: "file",
				column: "lexicon",
			}),
		];
	}
}

MigrationCLI.run(import.meta.url, M);
