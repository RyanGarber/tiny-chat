#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/e2d6f081111d9a1107dd051f8510bf1bd576a5942cd0a5f2cd4275d7dd575ce3/contract';
import endContract from '../../snapshots/e2d6f081111d9a1107dd051f8510bf1bd576a5942cd0a5f2cd4275d7dd575ce3/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/676190fef5cc52a9134d09948fb3271e30c1a57605038a1549e66c57917ac6e5/contract';
import startContract from '../../snapshots/676190fef5cc52a9134d09948fb3271e30c1a57605038a1549e66c57917ac6e5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, placeholder } from '@prisma/orm-postgres/migration';
import postgres from '@prisma/orm-postgres/runtime';
import paradedb from '@prisma/orm-extension-paradedb/runtime';
import pgvector from '@prisma/orm-extension-pgvector/runtime';
import {zod} from '../../../zod-extension.ts';

const db = postgres<End>({ contractJson: endContract, extensions: [paradedb, pgvector, zod.runtime] });

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'subagent',
        column: col('partId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dataTransform(db.contract, 'ensure-no-subagents', {
        check: () => db.sql.public.subagent.select().limit(1),
        run: () => db.sql.public.subagent.delete(),
      }),
      this.setNotNull({ schema: 'public', table: 'subagent', column: 'partId' }),
      this.createIndex({
        schema: 'public',
        table: 'subagent',
        index: 'subagent_partId_key',
        columns: ['partId'],
        extras: { unique: true },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
