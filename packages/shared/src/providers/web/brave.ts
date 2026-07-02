import { type WebProvider } from './index.ts';

export const Brave: WebProvider = {
  name: 'brave',
  settings: ['apiKey'],
  features: ['search'],

  async check(user) {
    if (!user?.settings?.providers?.brave?.apiKey) return false;
    const response = await fetch(
      `https://api.search.brave.com/res/v1/suggest/search?q=test&count=1&country=US`,
      {
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': user.settings.providers?.brave?.apiKey,
        },
      },
    );
    if (response.status === 422) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return true;
  },

  async search(user, query, maxResults) {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/llm/context?q=${encodeURIComponent(query)}&count=${maxResults}`,
      {
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': user.settings.providers?.brave?.apiKey,
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Failed: ${response.status} ${response.statusText}`);
    }
    const data = (await response.json()) as {
      grounding?: { generic?: { title: string; snippets: string[]; url: string }[] };
    };
    return (
      data.grounding?.generic?.map((result) => ({
        title: result.title,
        content: result.snippets.join('\n---\n'),
        url: result.url,
      })) ?? []
    );
  },

  // eslint-disable-next-line @typescript-eslint/require-await
  async view() {
    throw new Error('Unsupported');
  },
};
