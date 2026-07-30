import { CommonUtils } from "../../../../core/utils/CommonUtils.ts";
import type { WebProvider } from "../../types/web.ts";

export const TavilyProvider: WebProvider = {
	name: "tavily",
	type: "web",
	settings: ["apiKey"],

	async getStatus({ user }) {
		if (!user?.settings?.providers?.tavily?.apiKey)
			return { valid: false, features: [] };

		try {
			const usage = await fetch(`https://api.tavily.com/usage`, {
				headers: {
					Authorization: `Bearer ${user.settings.providers.tavily.apiKey}`,
				},
			});

			if (!usage.ok) {
				return {
					valid: false,
					features: [],
					error: `${usage.status} ${usage.statusText}`,
				};
			}

			return { valid: true, features: ["search", "view"] };
		} catch (error) {
			return {
				valid: false,
				features: [],
				error: CommonUtils.getErrorFormatted({ error }),
			};
		}
	},

	async search({ user, query, maxResults }) {
		const res = await fetch("https://api.tavily.com/search", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${user.settings.providers?.tavily.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ query, max_results: maxResults }),
		});

		if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

		const data = await res.json();

		return (
			data.results as { title: string; content: string; url: string }[]
		).map((r) => ({
			title: r.title,
			content: r.content,
			url: r.url,
		}));
	},

	async view({ user, url }) {
		const res = await fetch("https://api.tavily.com/extract", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${user.settings.providers?.tavily.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ urls: [url] }),
		});

		if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

		const data = await res.json();

		if (data.failed_results?.length)
			throw new Error((data.failed_results[0] as { error: string }).error);

		return (data.results as { url: string; raw_content: string }[]).map(
			(result) => ({
				content: result.raw_content,
				url: result.url,
			}),
		)[0];
	},
};
