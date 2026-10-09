#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/f55103d270835ebefcbcafdea11ae272e81ac32916a251335b317a9519000e75/contract';
import endContract from '../../snapshots/f55103d270835ebefcbcafdea11ae272e81ac32916a251335b317a9519000e75/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/18efe45a28542573bb4fd8a0d752bd6aa574127eccf0557915b0669cffcfb3da/contract';
import startContract from '../../snapshots/18efe45a28542573bb4fd8a0d752bd6aa574127eccf0557915b0669cffcfb3da/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [this.dropTable({ schema: 'public', table: 'chat_memory' })];
  }
}

MigrationCLI.run(import.meta.url, M);
