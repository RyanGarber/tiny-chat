import { type ToolCall, type ToolContext } from './index.ts';
import { z } from 'zod';
import { searchProviders } from '../providers/search/index.ts';
import { createHash } from 'crypto';

const zSearchWeb = z.object({
  query: z.string(),
});

const SearchWeb = {
  name: 'search_web',
  description: 'Search the web.',
  parameters: zSearchWeb.toJSONSchema(),
  schema: zSearchWeb,
  run: async ({ user }, params) => {
    const results = await searchProviders[0].search(user, params.query, 5);
    return results.map((r) => ({
      ...r,
      id: createHash('sha256').update(r.source).digest('hex').slice(0, 6),
    }));
  },
} satisfies ToolCall<typeof zSearchWeb>;

const zViewWeb = z.object({
  url: z.url(),
});

const ViewWeb = {
  name: 'view_web',
  description: 'View a webpage.',
  parameters: zViewWeb.toJSONSchema(),
  schema: zViewWeb,
  run: async (_, params) => {
    const response = await fetch(`https://r.jina.ai/${params.url}`);
    if (!response.ok) {
      console.error({ status: response.status, url: params.url }, await response.text());
      throw new Error('Failed to fetch webpage content');
    }
    await response.text();
  },
} satisfies ToolCall<typeof zViewWeb>;

export default function tools({ user }: ToolContext) {
  const searchProvider = searchProviders[0];
  if (!user.settings.providers?.[searchProvider.name]) {
    return [ViewWeb];
  }
  return [SearchWeb, ViewWeb];
}
