import { Brave } from './brave.ts';
import { Tavily } from './tavily.ts';
import { type User } from '../../server.ts';
import type { BaseProvider } from '../base.ts';

export interface SearchResult {
  id: string;
  title: string;
  source: string;
  content: string;
}

export interface WebProvider extends BaseProvider {
  features: ('search' | 'view')[];
  check: (user: User) => Promise<boolean>;
  search: (user: User, query: string, maxResults: number) => Promise<Omit<SearchResult, 'id'>[]>;
  view: (user: User, url: string) => Promise<string>;
}

export const webProviders: WebProvider[] = [Brave, Tavily];

export function getBestWebProvider(user: User, feature: WebProvider['features'][number]) {
  const preferred = user.settings?.preferredWebProvider;
  const available = webProviders.filter(
    (p) => user.settings?.providers?.[p.name]?.apiKey && p.features.includes(feature),
  );
  return available.find((p) => p.name === preferred) ?? available[0] ?? null;
}
