#!/usr/bin/env -S node
import { col, Migration, MigrationCLI } from "@prisma/orm-postgres/migration";
import type { Contract as End } from "../../snapshots/21225f9ef48f7637b8c8371348da7c244436a2972ccc52dd132347786be8468b/contract";
import endContract from "../../snapshots/21225f9ef48f7637b8c8371348da7c244436a2972ccc52dd132347786be8468b/contract.json" with {
	type: "json",
};
import type { Contract as Start } from "../../snapshots/c6afbbcc3ec78b8ca539b47dca3518e835206642d2abfe2f67eee2283eff0cb0/contract";
import startContract from "../../snapshots/c6afbbcc3ec78b8ca539b47dca3518e835206642d2abfe2f67eee2283eff0cb0/contract.json" with {
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
