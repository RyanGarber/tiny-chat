import { type SearchProvider, type SearchResult } from './index.ts';
import { type User } from '../../server.ts';

export const Brave: SearchProvider = {
  name: 'brave',
  settings: ['apiKey'],
  /* eslint-disable-next-line @typescript-eslint/require-await */
  async check(user) {
    if (!user?.settings?.providers?.[this.name]?.apiKey) return false;
    // TODO - all requests return 422
    /*const response = await fetch(`https://api.search.brave.com/res/v1/web/search`, {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': user.settings.providers?.[this.name]?.apiKey,
      },
    });
    if (response.status !== 422) {
      throw new Error(`${response.status} ${response.statusText}`);
    }*/
    return true;
  },
  async search(user: User, query: string, maxResults) {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/llm/context?q=${encodeURIComponent(query)}&count=${maxResults}`,
      {
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': user.settings.providers?.[this.name]?.apiKey,
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Failed: ${response.status} ${response.statusText}`);
    }
    const data = (await response.json()) as { grounding?: { generic?: any[] } };
    return (
      data.grounding?.generic?.map(
        (result) =>
          ({
            title: result.title,
            source: result.url,
            content: result.snippets.join('\n---\n'),
          }) satisfies SearchResult,
      ) ?? []
    );
  },
};
