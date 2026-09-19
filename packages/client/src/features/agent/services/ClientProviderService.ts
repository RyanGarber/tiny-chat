import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { ModelProviderService } from "@tiny-chat/core/src/features/provider/services/ModelProviderService.ts";
import type { Client } from "../../../client.ts";

export const ClientProviderService = {
	getModelProviders: async ({
		client,
		user,
	}: {
		client: Client;
		user: zUser;
	}) => {
		return [
			...ModelProviderService.providers,
			...((await client.providers?.getModelProviders({ client, user })) ?? []),
		];
	},

	getProviderStates: async ({
		client,
		user,
		update,
		providers,
	}: {
		client: Client;
		user: zUser;
		update?: boolean;
		providers?: string[];
	}) => {
		return [
			...(await client.api.user.getCache.query({ update, providers }))
				.providers,
			...((await client.providers?.getProviderStates({
				client,
				user,
				update,
			})) ?? []),
		];
	},
};
