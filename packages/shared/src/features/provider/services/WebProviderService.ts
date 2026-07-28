import type { zUser } from "../../data/types/user.ts";
import { BraveProvider } from "../providers/web/BraveProvider.ts";
import { TavilyProvider } from "../providers/web/TavilyProvider.ts";
import type { WebProvider, zWebFeature } from "../types/web.ts";

export const WebProviderService = {
	providers: [BraveProvider, TavilyProvider] satisfies WebProvider[],

	getBestProvider: ({
		user,
		feature,
	}: {
		user: zUser;
		feature: zWebFeature;
	}) => {
		const preferred = user.settings?.preferredWebProvider;
		const available = WebProviderService.providers.filter(
			(p) =>
				user.settings?.providers?.[p.name]?.apiKey &&
				p.features.includes(feature),
		);
		return available.find((p) => p.name === preferred) ?? available[0] ?? null;
	},
} as const;
