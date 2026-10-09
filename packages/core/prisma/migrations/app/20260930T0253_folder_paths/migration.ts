#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/44789167e815a55cf5c7d015de31365e1668fdaffacee6c64d1b2844a7e68cee/contract';
import endContract from '../../snapshots/44789167e815a55cf5c7d015de31365e1668fdaffacee6c64d1b2844a7e68cee/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/458e8172ec89bf1913c112c011c0bea14bc34cb265dc983d903f98688474d82b/contract';
import startContract from '../../snapshots/458e8172ec89bf1913c112c011c0bea14bc34cb265dc983d903f98688474d82b/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, rawSql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      // A folder's single path becomes the first entry of its settings' folders.
      rawSql({
        id: 'data.public.folder.settings.folders',
        label: 'Move "cwd" and "cwdWritable" into "settings.folders"',
        operationClass: 'data',
        target: {
          id: 'postgres',
          details: { schema: 'public', objectType: 'table', name: 'folder' },
        },
        precheck: [
          {
            description: 'ensure column "cwd" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "information_schema"."columns" WHERE ("table_schema" = $1 AND "table_name" = $2 AND "column_name" = $3)) AS "result"',
            params: ['public', 'folder', 'cwd'],
          },
        ],
        execute: [
          {
            description: 'copy "cwd" into "settings.folders"',
            sql: `UPDATE "public"."folder" SET "settings" = jsonb_set(COALESCE("settings", '{}'::jsonb), '{folders}', jsonb_build_array(jsonb_build_object('path', "cwd", 'writable', "cwdWritable"))) WHERE "cwd" IS NOT NULL AND "cwd" <> ''`,
          },
        ],
        postcheck: [],
      }),
      this.dropColumn({ schema: 'public', table: 'folder', column: 'cwd' }),
      this.dropColumn({ schema: 'public', table: 'folder', column: 'cwdWritable' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
