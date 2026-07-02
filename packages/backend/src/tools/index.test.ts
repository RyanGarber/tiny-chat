import { zChat, zContextItem } from '@tiny-chat/shared/src/types/chat.ts';
import { ToolContext } from '@tiny-chat/shared/src/types/tool.ts';
import { inject } from 'vitest';
import { testTRPC } from '../tests.ts';

export function testToolContext(
  chat?: zChat,
  context?: zContextItem[],
  overrides: Partial<ToolContext> = {},
): ToolContext {
  const user = inject('backend_user');
  const trpc = testTRPC();
  return {
    user: inject('backend_user'),
    chat: {
      id: chat?.id ?? 'zzzzzzzzzzzzzzzzzzzzzzzz',
      userId: chat?.userId ?? user.id,
      folderId: chat?.folderId ?? 'zzzzzzzzzzzzzzzzzzzzzzzz',
      incognito: chat?.incognito ?? false,
    },
    generation: {
      context: context ?? [],
      config: inject('backend_config'),
      timezone: 'America/New_York',
      incognito: chat?.incognito ?? false,
      supportsUserInput: false,
    },
    skills: [],
    callbacks: {
      listActions: () => trpc.context.listActions.query(),
      listFilesInChat: (chatId, uploadIds) =>
        trpc.input.listFilesInChat.query({ chatId, uploadIds }),
      getEmbedding: (input) => trpc.context.getEmbedding.query(input),
      embed: () => {
        throw new Error();
      },
      searchMemories: (text, embedding, limit) =>
        trpc.context.searchMemories.query({ text, embedding, limit }),
      searchChats: async (text, embedding, limit) =>
        (await trpc.chat.search.query({ text, embedding, limit })).results,
      getChat: (id, messageId) => trpc.chat.find.query({ id, messageId }),
    },
    ...overrides,
  };
}
