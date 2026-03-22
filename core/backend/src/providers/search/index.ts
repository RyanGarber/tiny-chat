import { Brave } from './brave.ts';
import { type User } from '../../server.ts';

export interface SearchResult {
  id: string;
  title: string;
  source: string;
  content: string;
}

export interface SearchProvider {
  name: string;
  settings: string[];
  check: (user: User) => Promise<boolean>;
  search: (user: User, query: string, maxResults: number) => Promise<SearchResult[]>;
}

export const searchProviders: SearchProvider[] = [Brave];
