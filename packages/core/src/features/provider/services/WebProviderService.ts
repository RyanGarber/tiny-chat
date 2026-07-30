import type { zUser } from "../../data/types/user.ts";
import { BraveProvider } from "../providers/web/BraveProvider.ts";
import { JinaProvider } from "../providers/web/JinaProvider.ts";
import { TavilyProvider } from "../providers/web/TavilyProvider.ts";
import type { ProviderState, ProviderStatus } from "../types/provider.ts";
import type {
	WebProvider,
	WebProviderStatus,
	zWebFeature,
} from "../types/web.ts";

export const WebProviderService = {
	providers: [
		BraveProvider,
		JinaProvider,
		TavilyProvider,
	] satisfies WebProvider[],

	getBestProvider: ({
		user,
		providers,
		feature,
	}: {
		user: zUser;
		providers: ProviderState<ProviderStatus>[];
		feature: zWebFeature;
	}) => {
		const preferred = user.settings?.preferredWebProvider;
		const available = providers.filter(
			(provider) =>
				provider.status.valid &&
				provider.type === "web" &&
				(
					provider as ProviderState<WebProviderStatus>
				).status.features?.includes(feature),
		);
		const state =
			available.find((provider) => provider.name === preferred) ??
			available.at(0) ??
			null;
		if (state) {
			const provider = WebProviderService.providers.find(
				(provider) => provider.name === state.name,
			);
			if (provider) return provider;
			return null;
		}
		return null;
	},
} as const;
