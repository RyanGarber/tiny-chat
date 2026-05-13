import { z } from 'zod';
import { Author, type Message } from '../../generated/prisma/client.ts';
import { zData } from '@tiny-chat/shared/src/types/chat.ts';
import { snippetText, texts } from '@tiny-chat/shared/src/utils.ts';
import { embed, getMostRelevant } from '@tiny-chat/shared/src/services/chat/embed.ts';
import type { Tool, ToolGroup } from '@tiny-chat/shared/src/types/tool.ts';

const zSearchChatsInput = z.object({
  query: z.string(),
  mode: z.enum(['semantic', 'regex']),
});

const zSearchChatsOutput = z.array(
  z.object({
    author: z.enum(Author),
    text: z.string(),
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
  run: async ({ user }, input) => {
    const messages = (
      await globalThis.prisma.$queryRaw<{ author: Author; data: any; embedding?: string }[]>`
      SELECT author, data, embedding FROM message WHERE "userId" = ${user.id}`
    ).filter((m) => texts(zData.parse(m.data)).trim().length);

    const result: z.infer<typeof zSearchChatsOutput> = [];

    if (input.mode === 'semantic') {
      const embeddings = await embed(user, [input.query], process.env);
      if (!embeddings) throw new Error('Failed to generate embedding for query');

      const relevant = getMostRelevant(
        embeddings[0],
        messages.flatMap((m) =>
          m.embedding ? [{ value: m, embedding: JSON.parse(m.embedding) }] : [],
        ),
      );

      for (const match of relevant) {
        result.push({
          author: (match.value as Message).author,
          text: snippetText(texts(zData.parse((match.value as Message).data)), input.query, 1000),
        });
      }
    } else if (input.mode === 'regex') {
      for (const message of messages) {
        const text = texts(zData.parse(message.data));
        const lines = text.split('\n');

        for (const line of lines) {
          const query = new RegExp(input.query, 'i');
          if (query.test(line)) {
            result.push({
              author: message.author,
              text: snippetText(text, query, 1000),
            });
          }
        }
      }
    }

    return result;
  },
};

export const chat: ToolGroup = {
  name: 'chat',
  tools: [SearchChats],
  instructions: {
    heading: 'Chats',
    body: `You have access to all prior chats with the user, not just this one.
You can search for messages across the entire history of the user using the search_chats tool.`,
  },
};
