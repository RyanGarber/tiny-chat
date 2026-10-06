import type { zUser } from "#core/features/data/types/user.ts";
import { ModelProviderService } from "#core/features/provider/services/ModelProviderService.ts";
import { OtherProviderService } from "#core/features/provider/services/OtherProviderService.ts";
import { WebProviderService } from "#core/features/provider/services/WebProviderService.ts";
import type {
	ProviderState,
	ProviderStatus,
} from "#core/features/provider/types/provider.ts";
export const ProviderService = {
	providers: [
		...ModelProviderService.providers,
		...WebProviderService.providers,
		...OtherProviderService.providers,
	],

	getProviderStates: async ({
		user,
		names,
	}: {
		user: zUser;
		names?: string[];
	}): Promise<ProviderState<ProviderStatus>[]> => {
		return Promise.all(
			ProviderService.providers
				.filter((provider) => !names || names.includes(provider.name))
				.map(
					async (provider) =>
						({
							...provider,
							status: await provider.getStatus({ user }),
						}) satisfies ProviderState<ProviderStatus>,
				),
		);
	},
} as const;
