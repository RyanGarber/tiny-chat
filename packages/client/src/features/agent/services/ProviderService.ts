import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { ModelProviderService } from "@tiny-chat/core/src/features/provider/services/ModelProviderService.ts";
import type { ModelProvider } from "@tiny-chat/core/src/features/provider/types/model.ts";
import type {
	ProviderState,
	ProviderStatus,
} from "@tiny-chat/core/src/features/provider/types/provider.ts";
import type { Client } from "../../../client.ts";

export interface ClientProviders {
	getModelProviders: (_: { user: zUser }) => Promise<ModelProvider<any>[]>;

	getProviderStates: (_: {
		user: zUser;
		update?: boolean;
	}) => Promise<ProviderState<ProviderStatus>[]>;
}

export const ProviderService = {
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
	}: {
		client: Client;
		user: zUser;
		update?: boolean;
	}) => {
		return [
			...(await client.api.user.getCache.query({ update })).providers,
			...((await client.providers?.getProviderStates({
				client,
				user,
				update,
			})) ?? []),
		];
	},
};
