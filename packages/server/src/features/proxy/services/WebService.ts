import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { WebProviderService } from "@tiny-chat/core/src/features/provider/services/WebProviderService.ts";
import type {
	ProviderState,
	ProviderStatus,
} from "@tiny-chat/core/src/features/provider/types/provider.ts";
import { CacheService } from "../../user/services/CacheService.ts";

export const WebService = {
	search: async ({
		user,
		query,
		providers,
		maxResults = 10,
	}: {
		user: zUser;
		query: string;
		providers?: ProviderState<ProviderStatus>[];
		maxResults?: number;
	}) => {
		providers ??= (await CacheService.getCache({ user })).providers;
		const provider = WebProviderService.getBestProvider({
			user,
			providers,
			feature: "search",
		});
		if (!provider) throw new Error("missing provider");
		return await provider.search({ user, query, maxResults });
	},

	view: async ({
		user,
		url,
		providers,
	}: {
		user: zUser;
		url: string;
		providers?: ProviderState<ProviderStatus>[];
	}) => {
		providers ??= (await CacheService.getCache({ user })).providers;
		const provider = WebProviderService.getBestProvider({
			user,
			providers,
			feature: "view",
		});
		if (!provider) throw new Error("missing provider");
		return await provider.view({ user, url });
	},
} as const;
