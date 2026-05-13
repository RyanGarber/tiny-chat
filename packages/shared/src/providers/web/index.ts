import { Brave } from './brave.ts';
import type { zUser } from '../../types/user.ts';
import type { BaseProvider } from '../index.ts';
import { Tavily } from './tavily.ts';

export interface SearchResult {
  id: string;
  title: string;
  source: string;
  content: string;
}

export interface WebProvider extends BaseProvider {
  features: ('search' | 'view')[];
  check: (user: zUser) => Promise<boolean>;
  search: (user: zUser, query: string, maxResults: number) => Promise<Omit<SearchResult, 'id'>[]>;
  view: (user: zUser, url: string) => Promise<string>;
}

export const webProviders: WebProvider[] = [Brave, Tavily];

export function getBestWebProvider(user: zUser, feature: WebProvider['features'][number]) {
  const preferred = user.settings?.preferredWebProvider;
  const available = webProviders.filter(
    (p) => user.settings?.providers?.[p.name]?.apiKey && p.features.includes(feature),
  );
  return available.find((p) => p.name === preferred) ?? available[0] ?? null;
}
