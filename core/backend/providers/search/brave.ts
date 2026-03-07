import {type SearchProvider, type SearchResult} from "./index.ts";
import {type Session} from "../../server.ts";

export const Brave: SearchProvider = {
    name: "brave",
    settings: ["apiKey"],
    async search(session: Session, query: string, maxResults) {
        const response = await fetch(`https://api.search.brave.com/res/v1/llm/context?q=${encodeURIComponent(query)}&count=${maxResults}`, {
            headers: {
                "Accept": "application/json",
                "X-Subscription-Token": session.user.settings.services?.[this.name]?.apiKey
            }
        });
        if (!response.ok) {
            throw new Error(`Search failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return data.grounding?.generic?.map((result: any) => ({
            title: result.title,
            source: result.url,
            content: result.snippets.join("\n---\n")
        } satisfies SearchResult)) || [];
    }
}