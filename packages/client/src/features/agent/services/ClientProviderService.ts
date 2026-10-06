import type { Client } from "#client/client.ts";
import type { zUser } from "#core/features/data/types/user.ts";
import { ModelProviderService } from "#core/features/provider/services/ModelProviderService.ts";

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
