import { z } from 'zod';
import { type CustomTool } from './index.ts';

const schema = z.object({
  url: z.url().describe('The URL of the webpage to view'),
});

export const ViewWeb: CustomTool<typeof schema> = {
  name: 'view_web',
  description:
    'View the content of a webpage. Use this tool when you need information from webpage and search results or training knowledge do not suffice.',
  parameters: schema.toJSONSchema(),
  schema,
  run: async (_session, params) => {
    const response = await fetch(`https://r.jina.ai/${params.url}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch webpage: ${response.status} ${response.statusText}`);
    }
    return await response.text();
  },
};
