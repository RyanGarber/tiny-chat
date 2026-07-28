import type { zUser } from "@tiny-chat/shared/src/features/data/types/user.ts";
import { WebProviderService } from "@tiny-chat/shared/src/features/provider/services/WebProviderService.ts";

export const WebService = {
	search: async ({
		user,
		query,
		maxResults = 10,
	}: {
		user: zUser;
		query: string;
		maxResults?: number;
	}) => {
		const provider = WebProviderService.getBestProvider({
			user,
			feature: "search",
		});
		return await provider.search({ user, query, maxResults });
	},

	view: async ({ user, url }: { user: zUser; url: string }) => {
		const provider = WebProviderService.getBestProvider({
			user,
			feature: "view",
		});
		return await provider.view({ user, url });
	},
} as const;
