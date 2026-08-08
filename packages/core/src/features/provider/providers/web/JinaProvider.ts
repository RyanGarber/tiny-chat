import type { WebProvider } from "../../types/web.ts";

export const JinaProvider: WebProvider = {
	name: "jina",
	type: "web",
	settings: ["apiKey"],

	getStatus: async ({ user }) => {
		// TODO - validate key
		return {
			valid: true,
			features: user.settings?.providers?.jina?.apiKey
				? ["view", "search"]
				: ["view"],
		};
	},

	search: async ({ user, query, maxResults }) => {
		const result = await fetch(
			`https://s.jina.ai/?q=${encodeURIComponent(query)}`,
			{
				headers: {
					Accept: "application/json",
					Authorization: `Bearer ${user.settings?.providers?.jina?.apiKey}`,
				},
			},
		);
		if (!result.ok) throw new Error(`${result.status} ${result.statusText}`);

		const { data } = (await result.json()) as {
			data: {
				title: string;
				description: string;
				url: string;
				content: string;
			}[];
		};
		return data.slice(0, maxResults).map((item) => ({
			url: item.url,
			title: item.title,
			content: item.content,
		}));
	},

	view: async ({ url }) => {
		const result = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
			headers: {
				Accept: "application/json",
			},
		});
		if (!result.ok) throw new Error(`${result.status} ${result.statusText}`);

		const { data } = (await result.json()) as {
			data: {
				title: string;
				description: string;
				url: string;
				content: string;
			};
		};
		return {
			url: data.url,
			title: data.title,
			content: data.content,
		};
	},
};
