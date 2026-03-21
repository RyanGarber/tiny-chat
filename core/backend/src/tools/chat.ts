import { z } from 'zod';
import type { ToolCall, ToolContext } from './index.ts';
import { embed, getMostRelevant } from '../utils/embed.ts';
import { type Message } from '../../generated/prisma/client.ts';
import { snippetText, texts, zData } from '../types.ts';

const zSearchChats = z.object({
  query: z.string().describe('The search query to find relevant chats.'),
});

const SearchChats = {
  name: 'search_chats',
  description: 'Search for messages in all past chats based on a query.',
  parameters: zSearchChats.toJSONSchema(),
  schema: zSearchChats,
  run: async ({ user }, params) => {
    const embeddings = await embed(user, [params.query]);
    if (!embeddings) throw new Error('Failed to generate embedding for query');

    const messages = (
      await globalThis.prisma.$queryRaw<(Message & { embedding?: string })[]>`
      SELECT * FROM message WHERE "userId" = ${user.id}`
    ).filter((m) => texts(zData.parse(m.data)).trim().length);

    const relevant = getMostRelevant(
      embeddings[0],
      messages.flatMap((m) =>
        m.embedding ? [{ value: m, embedding: JSON.parse(m.embedding) }] : [],
      ),
    );

    return {
      messages: relevant.map((r) => ({
        author: (r.value as Message).author,
        text: snippetText(texts(zData.parse((r.value as Message).data)), params.query, 1000),
      })),
    };
  },
} satisfies ToolCall<typeof zSearchChats>;

export default function tools({ user }: ToolContext) {
  if (!user.settings.embeddingConfig) return [];
  return [SearchChats];
}
