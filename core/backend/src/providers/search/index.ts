import { Brave } from './brave.ts';
import { type User } from '../../server.ts';
import type { BaseProvider } from '../base.ts';

export interface SearchResult {
  id: string;
  title: string;
  source: string;
  content: string;
}

export interface SearchProvider extends BaseProvider {
  check: (user: User) => Promise<boolean>;
  search: (user: User, query: string, maxResults: number) => Promise<Omit<SearchResult, 'id'>[]>;
}

export const searchProviders: SearchProvider[] = [Brave];
