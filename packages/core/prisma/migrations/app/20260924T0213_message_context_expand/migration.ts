#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/863e5936f83e2670877f21b0bd03110a7c194a50fcee3288b47a1b4fee4725a4/contract';
import startContract from '../../snapshots/863e5936f83e2670877f21b0bd03110a7c194a50fcee3288b47a1b4fee4725a4/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/18efe45a28542573bb4fd8a0d752bd6aa574127eccf0557915b0669cffcfb3da/contract';
import endContract from '../../snapshots/18efe45a28542573bb4fd8a0d752bd6aa574127eccf0557915b0669cffcfb3da/contract.json' with { type: 'json' };
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
