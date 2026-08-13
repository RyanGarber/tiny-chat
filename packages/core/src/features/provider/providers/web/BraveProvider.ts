import { CommonUtils } from "../../../../core/utils/CommonUtils.ts";
import type { WebProvider } from "../../types/web.ts";

export const BraveProvider: WebProvider = {
	name: "brave",
	type: "web",
	settings: ["apiKey"],

	async getStatus({ user }) {
		if (!user?.settings?.providers?.brave?.apiKey)
			return { valid: false, features: [] };

		try {
			const response = await fetch(
				`https://api.search.brave.com/res/v1/suggest/search?q=test&count=1&country=US`,
				{
					headers: {
						Accept: "application/json",
						"X-Subscription-Token": user.settings.providers?.brave?.apiKey,
					},
				},
			);

			if (response.status === 422) {
				return {
					valid: false,
					features: [],
					error: `${response.status} ${response.statusText}`,
				};
			}

			return { valid: true, features: ["search"] };
		} catch (error) {
			return {
				valid: false,
				features: [],
				error: CommonUtils.formatError({ error }),
			};
		}
	},

	async search({ user, query, maxResults }) {
		const response = await fetch(
			`https://api.search.brave.com/res/v1/llm/context?q=${encodeURIComponent(query)}&count=${maxResults}`,
			{
				headers: {
					Accept: "application/json",
					"X-Subscription-Token": user.settings.providers?.brave?.apiKey,
				},
			},
		);

		if (!response.ok) {
			throw new Error(`Failed: ${response.status} ${response.statusText}`);
		}

		const data = (await response.json()) as {
			grounding?: {
				generic?: { title: string; snippets: string[]; url: string }[];
			};
		};

		return (
			data.grounding?.generic?.map((result) => ({
				title: result.title,
				content: result.snippets.join("\n---\n"),
				url: result.url,
			})) ?? []
		);
	},

	async view() {
		throw new Error("not supported");
	},
};
