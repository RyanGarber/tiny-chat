#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/d68206c7c8ea6202887694ac928d59e127555b0fb5d78c46fafbc7cc860b305c/contract';
import endContract from '../../snapshots/d68206c7c8ea6202887694ac928d59e127555b0fb5d78c46fafbc7cc860b305c/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e072feb61c63726962e88d2c4f8f44ab767e9bf4157dfa9d752619a81341517e/contract';
import startContract from '../../snapshots/e072feb61c63726962e88d2c4f8f44ab767e9bf4157dfa9d752619a81341517e/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [this.dropTable({ schema: 'public', table: 'chat_memory' })];
  }
}

MigrationCLI.run(import.meta.url, M);
