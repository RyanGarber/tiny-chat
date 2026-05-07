import { type ToolCall, type ToolContext } from './index.ts';
import { z } from 'zod';
import { getBestWebProvider } from '../providers/web/index.ts';
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
    const results = await getBestWebProvider(user, 'search').search(user, params.query, 5);
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
  run: async ({ user }, params) => {
    const provider = getBestWebProvider(user, 'view');
    if (provider) {
      try {
        return await provider.view(user, params.url);
      } catch (error) {
        console.warn('Failed to use provider for view_web, falling back to r.jina.ai');
        console.error(error);
      }
    }
    const response = await fetch(`https://r.jina.ai/${params.url}`);
    const text = await response.text();
    if (!response.ok || !text) {
      console.error({ status: response.status, url: params.url }, await response.text());
      throw new Error('Failed to fetch webpage content');
    }
    return text;
  },
} satisfies ToolCall<typeof zViewWeb>;

export default function tools({ user }: ToolContext) {
  const tools: ToolCall[] = [ViewWeb];
  if (getBestWebProvider(user, 'search')) tools.push(SearchWeb);
  return tools;
}
