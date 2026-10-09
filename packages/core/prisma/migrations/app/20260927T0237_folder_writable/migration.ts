#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0dd6755bbc134f68ac8843a928c5fa85524f868232ebefbac31c9c2eeedc842c/contract';
import endContract from '../../snapshots/0dd6755bbc134f68ac8843a928c5fa85524f868232ebefbac31c9c2eeedc842c/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f55103d270835ebefcbcafdea11ae272e81ac32916a251335b317a9519000e75/contract';
import startContract from '../../snapshots/f55103d270835ebefcbcafdea11ae272e81ac32916a251335b317a9519000e75/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'folder',
        column: col('cwdWritable', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
