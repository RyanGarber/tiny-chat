#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/863e5936f83e2670877f21b0bd03110a7c194a50fcee3288b47a1b4fee4725a4/contract';
import endContract from '../../snapshots/863e5936f83e2670877f21b0bd03110a7c194a50fcee3288b47a1b4fee4725a4/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/fbfd02f4ce7239d1569f5a744c4fbcdfc675786ba8aa4ff697acf28ff08ce55f/contract';
import startContract from '../../snapshots/fbfd02f4ce7239d1569f5a744c4fbcdfc675786ba8aa4ff697acf28ff08ce55f/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'folder',
        column: col('settings', '"jsonb"', {
          notNull: true,
          default: lit({}),
          codecRef: {
            codecId: 'zod/json@1',
            typeParams: {
              export: 'SchemaTypes',
              key: 'zSettings',
              module: '../../prisma/zod-extension.ts',
            },
          },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
