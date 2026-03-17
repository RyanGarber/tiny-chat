import { type ToolCall, type ToolContext } from './index.ts';
import { z } from 'zod';
import { searchProviders } from '../providers/search/index.ts';

const zSearchWeb = z.object({
  query: z.string().describe('The search query to use for web search'),
});

const SearchWeb = {
  name: 'search_web',
  description:
    'Search the web for information. Use this tool to find up-to-date information on any topic.',
  parameters: zSearchWeb.toJSONSchema(),
  schema: zSearchWeb,
  run: async ({ user }, params) => {
    return await searchProviders[0].search(user, params.query, 5);
  },
} satisfies ToolCall<typeof zSearchWeb>;

const zViewWeb = z.object({
  url: z.url().describe('The URL of the webpage to view'),
});

const ViewWeb = {
  name: 'view_web',
  description:
    'View the content of a webpage. Use this tool when you need information from webpage and search results or training knowledge do not suffice.',
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
