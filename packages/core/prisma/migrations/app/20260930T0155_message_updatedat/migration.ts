#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/89feade643133e4e691e0921e74e2679868fa5af5adf48ad71dcdc9c37c41f78/contract';
import startContract from '../../snapshots/89feade643133e4e691e0921e74e2679868fa5af5adf48ad71dcdc9c37c41f78/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d0822a0a7bffd62db8d407952646c3a66036b397bc308c95476106fbdd937a0e/contract';
import endContract from '../../snapshots/d0822a0a7bffd62db8d407952646c3a66036b397bc308c95476106fbdd937a0e/contract.json' with { type: 'json' };
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
