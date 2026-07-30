import type { zUser } from "../../data/types/user.ts";
import type { ProviderState, ProviderStatus } from "../types/provider.ts";
import { ModelProviderService } from "./ModelProviderService.ts";
import { OtherProviderService } from "./OtherProviderService.ts";
import { WebProviderService } from "./WebProviderService.ts";
export const ProviderService = {
	providers: [
		...ModelProviderService.providers,
		...WebProviderService.providers,
		...OtherProviderService.providers,
	],

	getProviderStates: async ({
		user,
	}: {
		user: zUser;
	}): Promise<ProviderState<ProviderStatus>[]> => {
		return Promise.all(
			ProviderService.providers.map(
				async (provider) =>
					({
						...provider,
						status: await provider.getStatus({ user }),
					}) satisfies ProviderState<ProviderStatus>,
			),
		);
	},
} as const;
