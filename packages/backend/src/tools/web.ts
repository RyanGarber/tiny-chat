import { z } from 'zod';
import { createHash } from 'crypto';
import type { Tool, ToolGroup } from '@tiny-chat/shared/src/types/tool.ts';
import { getBestWebProvider } from '@tiny-chat/shared/src/providers/web/index.ts';

const zSearchWebInput = z.object({
  query: z.string(),
});

const zSearchWebOutput = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    source: z.string(),
    content: z.string(),
  }),
);

const SearchWeb: Tool<typeof zSearchWebInput, typeof zSearchWebOutput> = {
  name: 'search_web',
  description: 'Search the web.',
  input: zSearchWebInput.toJSONSchema(),
  output: zSearchWebOutput.toJSONSchema(),
  requirements: {
    provider: ['brave', 'tavily'],
  },
  run: async ({ user }, input) => {
    const results = await getBestWebProvider(user, 'search').search(user, input.query, 5);
    return results.map((r) => ({
      ...r,
      id: createHash('sha256').update(r.source).digest('hex').slice(0, 6),
    }));
  },
};

const zViewWebInput = z.object({
  urls: z.array(z.url()),
});

const zViewWebOutput = z.array(z.object({ url: z.url(), content: z.string() }));

const ViewWeb: Tool<typeof zViewWebInput, typeof zViewWebOutput> = {
  name: 'view_web',
  description: 'View the contents of webpages.',
  input: zViewWebInput.toJSONSchema(),
  output: zViewWebOutput.toJSONSchema(),
  run: async ({ user }, params) => {
    const provider = getBestWebProvider(user, 'view');

    const result: Awaited<ReturnType<typeof ViewWeb.run>> = [];

    for (const url of params.urls) {
      try {
        const content = await provider.view(user, url);
        result.push({ url, content });
      } catch (error) {
        console.warn(`Failed to view ${url} with provider, falling back to r.jina.ai`);
        console.error(error);
        const response = await fetch(`https://r.jina.ai/${url}`);
        const text = await response.text();
        if (!response.ok || !text) {
          console.error({ status: response.status, url }, text);
          throw new Error('Failed to fetch webpage content', { cause: error });
        }
        result.push({ url, content: text });
      }
    }

    return result;
  },
};

export const web: ToolGroup = {
  name: 'web',
  tools: [ViewWeb, SearchWeb],
  instructions: {
    heading: 'Web',
    body: `You have access to the internet.
For information that does not change often, such as historical facts, scientific principles, or general knowledge, rely on your training data.
For information that does change often, such as news, current events, and coding, always search the web to get the most up-to-date information.`,
  },
};
