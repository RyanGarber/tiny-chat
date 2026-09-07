#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/1f7bbf5704cd07502d81d65e27ac60239068cfd0ebbb22f515191bea3636acec/contract';
import endContract from '../../snapshots/1f7bbf5704cd07502d81d65e27ac60239068cfd0ebbb22f515191bea3636acec/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/21225f9ef48f7637b8c8371348da7c244436a2972ccc52dd132347786be8468b/contract';
import startContract from '../../snapshots/21225f9ef48f7637b8c8371348da7c244436a2972ccc52dd132347786be8468b/contract.json' with { type: 'json' };
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
