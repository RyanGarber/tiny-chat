import {Brave} from "./brave.ts";
import {type Session} from "../../server.ts";

export interface SearchResult {
    title: string;
    source: string;
    content: string;
}

export interface SearchProvider {
    name: string;
    settings: string[];
    search: (session: Session, query: string, maxResults: number) => Promise<SearchResult[]>;
}

export const searchProviders: SearchProvider[] = [Brave];