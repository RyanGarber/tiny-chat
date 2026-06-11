import { z } from 'zod';
import type { ChatSearchResult } from '@tiny-chat/shared/src/types/chat.ts';
import type { Tool, ToolGroup } from '@tiny-chat/shared/src/types/tool.ts';
import { scrubText, snippetText, texts } from '@tiny-chat/shared/src/utils.ts';

const zSearchChatsInput = z.object({
  query: z.string(),
  mode: z.enum(['semantic', 'regex']),
});

const zSearchChatsOutput = z.array(
  z.object({
    author: z.string(),
    chatTitle: z.string().nullable(),
    snippet: z.string(),
    createdAt: z.iso.datetime(),
  }),
);

const SearchChats: Tool<typeof zSearchChatsInput, typeof zSearchChatsOutput> = {
  name: 'search_chats',
  description: 'Search for messages across all chats.',
  input: zSearchChatsInput.toJSONSchema(),
  output: zSearchChatsOutput.toJSONSchema(),
  requirements: {
    embeddings: true,
    notIncognito: true,
  },
  run: async ({ user, callbacks }, input) => {
    let result: ChatSearchResult[] = [];
    if (input.mode === 'semantic') {
      const embedding = await callbacks.embed(input.query);
      result = await callbacks.searchChats(input.query, embedding ?? undefined);
    } else if (input.mode === 'regex') {
      result = await globalThis.prisma.$queryRaw<ChatSearchResult[]>`
        SELECT
          m.id AS id,
          m."chatId" as chatId,
          m."author" as author,
          m."data" as data,
          m."createdAt" as "createdAt",
          c.title as "chatTitle"
        FROM message m
        LEFT JOIN chat c ON m."chatId" = c."id"
       WHERE m."data" ~ ${input.query} AND m."userId" = ${user.id}`;
    }
    return result.map((r) => ({
      author: r.author,
      chatTitle: r.chatTitle,
      snippet: snippetText(scrubText(texts(r.data)), input.query, 1000),
      createdAt: r.createdAt.toISOString(),
    }));
  },
};

export const chats: ToolGroup = {
  name: 'chats',
  tools: [SearchChats],
  instructions: {
    heading: 'Chats',
    body: `You have access to all prior chats with the user, not just this one.
You can search for messages across the entire history of the user using the search_chats tool.`,
  },
};
