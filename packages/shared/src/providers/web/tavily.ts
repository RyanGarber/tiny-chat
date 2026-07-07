import type { WebProvider } from './index.ts';

export const Tavily: WebProvider = {
  name: 'tavily',
  settings: ['apiKey'],
  features: ['search', 'view'],

  async check(user) {
    if (!user?.settings?.providers?.tavily?.apiKey) return false;
    const usage = await fetch(`https://api.tavily.com/usage`, {
      headers: { Authorization: `Bearer ${user.settings.providers.tavily.apiKey}` },
    });
    if (!usage.ok) {
      throw new Error(`${usage.status} ${usage.statusText}`);
    }
    return true;
  },

  async search(user, query, maxResults) {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${user.settings.providers!.tavily.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, max_results: maxResults }),
    });

    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

    const data = await res.json();
    return (data.results as { title: string; content: string; url: string }[]).map((r) => ({
      title: r.title,
      content: r.content,
      url: r.url,
    }));
  },

  async view(user, url) {
    const res = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${user.settings.providers!.tavily.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ urls: [url] }),
    });

    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

    const data = await res.json();

    if (data.failed_results?.length)
      throw new Error((data.failed_results[0] as { error: string }).error);

    return (data.results as { url: string; raw_content: string }[]).map((result) => ({
      content: result.raw_content,
      url: result.url,
    }))[0];
  },
};
