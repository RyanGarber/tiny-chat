import { describe, expect, inject, it } from 'vitest';
import { testTRPC } from '../tests.ts';

describe('routes - message', () => {
  const trpc = testTRPC();

  it('creates a new chat with two messages', async () => {
    const first = await trpc.message.create.mutate({
      author: 'USER',
      config: inject('config'),
      data: [[{ type: 'text', value: 'First message' }]],
      metadata: [],
    });

    const second = await trpc.message.create.mutate({
      chatId: first.chatId,
      author: 'MODEL',
      config: inject('config'),
      data: [[{ type: 'text', value: 'Reply from model' }]],
      metadata: [],
    });

    const chat = await trpc.chat.find.query({ messageId: first.id });
    expect(chat).not.toBeNull();
    expect(second.chatId).toBe(first.chatId);
  });

  it('edits a message and truncates the rest of the chat', async () => {
    const first = await trpc.message.create.mutate({
      author: 'USER',
      config: inject('config'),
      data: [[{ type: 'text', value: 'User message' }]],
      metadata: [],
    });

    await trpc.message.create.mutate({
      chatId: first.chatId,
      author: 'MODEL',
      config: inject('config'),
      data: [[{ type: 'text', value: 'Model reply' }]],
      metadata: [],
    });

    await trpc.message.edit.mutate({
      id: first.id,
      author: 'USER',
      config: inject('config'),
      data: [[{ type: 'text', value: 'Edited user message' }]],
      metadata: [],
      truncate: true,
    });

    const messages = await trpc.message.list.query({ chatId: first.chatId });
    expect(messages).toHaveLength(1);
  });

  it('deletes the last message which deletes the chat', async () => {
    const first = await trpc.message.create.mutate({
      author: 'USER',
      config: inject('config'),
      data: [[{ type: 'text', value: 'User message' }]],
      metadata: [],
    });

    await trpc.message.create.mutate({
      chatId: first.chatId,
      author: 'MODEL',
      config: inject('config'),
      data: [[{ type: 'text', value: 'Model reply' }]],
      metadata: [],
    });

    await trpc.message.delete.mutate({
      id: first.id,
    });

    const chat = await trpc.chat.find.query({ messageId: first.id });
    expect(chat).toBeNull();
  });

  it('returns empty array for unknown chatId', async () => {
    const messages = await trpc.message.list.query({ chatId: null });
    expect(messages).toEqual([]);
  });
});
