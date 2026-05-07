import type { WebProvider } from './index.ts';
import { tavily } from '@tavily/core';

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
    const search = await tavily({ apiKey: user.settings.providers.tavily.apiKey }).search(query, {
      maxResults,
    });
    console.log('[Tavily] search', search);
    return search.results.map((r) => ({
      title: r.title,
      source: r.url,
      content: r.content,
    }));
  },

  async view(user, url) {
    const extract = await tavily({ apiKey: user.settings.providers.tavily.apiKey }).extract([url]);
    if (extract.failedResults.length) throw new Error(extract.failedResults[0].error);
    return extract.results[0].rawContent;
  },
};
