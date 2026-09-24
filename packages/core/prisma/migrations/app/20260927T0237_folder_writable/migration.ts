#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/89feade643133e4e691e0921e74e2679868fa5af5adf48ad71dcdc9c37c41f78/contract';
import endContract from '../../snapshots/89feade643133e4e691e0921e74e2679868fa5af5adf48ad71dcdc9c37c41f78/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/d68206c7c8ea6202887694ac928d59e127555b0fb5d78c46fafbc7cc860b305c/contract';
import startContract from '../../snapshots/d68206c7c8ea6202887694ac928d59e127555b0fb5d78c46fafbc7cc860b305c/contract.json' with { type: 'json' };
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
