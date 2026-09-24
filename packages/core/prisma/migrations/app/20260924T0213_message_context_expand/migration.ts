#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/1f7bbf5704cd07502d81d65e27ac60239068cfd0ebbb22f515191bea3636acec/contract';
import startContract from '../../snapshots/1f7bbf5704cd07502d81d65e27ac60239068cfd0ebbb22f515191bea3636acec/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e072feb61c63726962e88d2c4f8f44ab767e9bf4157dfa9d752619a81341517e/contract';
import endContract from '../../snapshots/e072feb61c63726962e88d2c4f8f44ab767e9bf4157dfa9d752619a81341517e/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'message_context',
        columns: [
          col('memoryId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('messageId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['messageId', 'memoryId'], { name: 'message_context_pkey' })],
      }),
      this.createIndex({
        schema: 'public',
        table: 'message_context',
        index: 'message_context_memoryId_idx',
        columns: ['memoryId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'message_context',
        index: 'message_context_messageId_idx',
        columns: ['messageId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'message_context',
        foreignKey: {
          name: 'message_context_messageId_fkey',
          columns: ['messageId'],
          references: { schema: 'public', table: 'message', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'message_context',
        foreignKey: {
          name: 'message_context_memoryId_fkey',
          columns: ['memoryId'],
          references: { schema: 'public', table: 'memory', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
