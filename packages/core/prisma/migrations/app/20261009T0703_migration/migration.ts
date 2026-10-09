#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/d0d217dde6572df3f9f414a24451b6c815bc5a4f762662d808a4b5de1f6a7b90/contract';
import endContract from '../../snapshots/d0d217dde6572df3f9f414a24451b6c815bc5a4f762662d808a4b5de1f6a7b90/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e2d6f081111d9a1107dd051f8510bf1bd576a5942cd0a5f2cd4275d7dd575ce3/contract';
import startContract from '../../snapshots/e2d6f081111d9a1107dd051f8510bf1bd576a5942cd0a5f2cd4275d7dd575ce3/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [];
  }
}

MigrationCLI.run(import.meta.url, M);
