#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/0dd6755bbc134f68ac8843a928c5fa85524f868232ebefbac31c9c2eeedc842c/contract';
import startContract from '../../snapshots/0dd6755bbc134f68ac8843a928c5fa85524f868232ebefbac31c9c2eeedc842c/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/458e8172ec89bf1913c112c011c0bea14bc34cb265dc983d903f98688474d82b/contract';
import endContract from '../../snapshots/458e8172ec89bf1913c112c011c0bea14bc34cb265dc983d903f98688474d82b/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'message',
        column: col('updatedAt', 'timestamp(3)', {
          codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
