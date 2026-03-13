import { z } from 'zod';
import type { CustomTool, ToolContext } from './index.ts';
import { embed, getMostRelevant } from '../embed.ts';
import { type Message } from '../../generated/prisma/client.ts';
import { texts, zData } from '../types.ts';

const zSearchChats = z.object({
  query: z.string().describe('The search query to find relevant chats.'),
});

const SearchChats = {
  name: 'search_chats',
  description: 'Search for messages in all past chats based on a query.',
  parameters: zSearchChats.toJSONSchema(),
  schema: zSearchChats,
  run: async ({ session }, params) => {
    const embeddings = await embed(session, [params.query]);
    if (!embeddings) {
      console.warn('Failed to generate embedding for query');
      return;
    }
    const messages = (
      await globalThis.prisma.$queryRaw<(Message & { embedding: string })[]>`
      SELECT * FROM message WHERE "userId" = ${session.user.id}`
    ).filter((m) => texts(zData.parse(m.data)).trim().length);
    const relevant = getMostRelevant(
      embeddings[0],
      messages.map((m) => ({ value: m, embedding: JSON.parse(m.embedding) })),
    );
    return {
      messages: relevant.map((r) => ({
        author: (r.value as Message).author,
        text: snippetText(texts(zData.parse((r.value as Message).data)), params.query, 1000),
      })),
    };
  },
} satisfies CustomTool<typeof zSearchChats>;

export default function tools({ session }: ToolContext) {
  if (!session.user.settings.embeddingConfig) return [];
  return [SearchChats];
}

function snippetText(text: string, query: string, window = 160): string {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const lower = text.toLowerCase();
  let matchIndex = -1;
  for (const term of terms) {
    const idx = lower.indexOf(term);
    if (idx !== -1) {
      matchIndex = idx;
      break;
    }
  }
  if (matchIndex === -1) return text.length > window ? text.slice(0, window) + '…' : text;
  const half = Math.floor(window / 2);
  let start = Math.max(0, matchIndex - half);
  let end = Math.min(text.length, matchIndex + half);
  // Snap to nearest word boundaries
  if (start > 0) {
    const i = text.indexOf(' ', start);
    if (i !== -1 && i < matchIndex) start = i + 1;
  }
  if (end < text.length) {
    const i = text.lastIndexOf(' ', end);
    if (i !== -1 && i > matchIndex) end = i;
  }
  const snippet = text.slice(start, end).trim();
  return (start > 0 ? '…' : '') + snippet + (end < text.length ? '…' : '');
}
