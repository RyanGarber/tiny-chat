import { z } from 'zod';
import type { ToolCall, ToolContext } from './index.ts';
import { embed, getMostRelevant } from '../utils/embed.ts';
import type { Author } from '../../generated/prisma/client.ts';
import { type Message } from '../../generated/prisma/client.ts';
import { snippetText, texts, zData } from '../types.ts';

const zSearchChats = z.object({
  query: z.string(),
  mode: z.enum(['semantic', 'regex']),
});

const SearchChats = {
  name: 'search_chats',
  description: 'Search for messages across all chats.',
  parameters: zSearchChats.toJSONSchema(),
  schema: zSearchChats,
  run: async ({ user }, params) => {
    interface match {
      author: string;
      text: string;
    }

    const messages = (
      await globalThis.prisma.$queryRaw<{ author: Author; data: any; embedding?: string }[]>`
      SELECT author, data, embedding FROM message WHERE "userId" = ${user.id}`
    ).filter((m) => texts(zData.parse(m.data)).trim().length);

    if (params.mode === 'semantic') {
      const embeddings = await embed(user, [params.query]);
      if (!embeddings) throw new Error('Failed to generate embedding for query');

      const relevant = getMostRelevant(
        embeddings[0],
        messages.flatMap((m) =>
          m.embedding ? [{ value: m, embedding: JSON.parse(m.embedding) }] : [],
        ),
      );

      return {
        messages: relevant.map(
          (r) =>
            ({
              author: (r.value as Message).author,
              text: snippetText(texts(zData.parse((r.value as Message).data)), params.query, 1000),
            }) satisfies match,
        ),
      };
    } else if (params.mode === 'regex') {
      const matches: match[] = [];

      for (const message of messages) {
        const text = texts(zData.parse(message.data));
        const lines = text.split('\n');
        lines.forEach((line) => {
          const query = new RegExp(params.query, 'i');
          if (query.test(line)) {
            matches.push({
              author: message.author,
              text: snippetText(text, query, 1000),
            } satisfies match);
          }
        });
      }

      return matches;
    }
  },
} satisfies ToolCall<typeof zSearchChats>;

export default function tools({ user }: ToolContext) {
  if (!user.settings.embeddingConfig) return [];
  return [SearchChats];
}
