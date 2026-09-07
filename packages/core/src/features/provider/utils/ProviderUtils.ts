import type { ProviderState, ProviderStatus } from "../types/provider.ts";

export const ProviderUtils = {
	isValid: (
		providers: ProviderState<ProviderStatus>[],
		config?: { provider: string } | null,
	) => {
		return (
			config &&
			providers.some(
				(state) => state.name === config.provider && state.status.valid,
			)
		);
	},
} as const;
