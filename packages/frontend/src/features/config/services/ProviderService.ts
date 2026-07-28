import { isTauriWithAfm, trpc } from "#frontend/utils/api.ts";
import type { zUser } from "#shared/features/data/types/user.ts";
import { ModelProviderService } from "#shared/features/provider/services/ModelProviderService.ts";
import type {
	ModelProvider,
	ModelProviderStatus,
} from "#shared/features/provider/types/model.ts";
import type { ProviderState } from "#shared/features/provider/types/provider.ts";

export const ProviderService = {
	getModelProviders: async (user: zUser) => {
		const providers: ModelProvider<any>[] = [...ModelProviderService.providers];

		if (user.settings.useBrowserModels) {
			const { WebLLMProvider } = await import("./WebLLMProvider.ts");
			providers.push(WebLLMProvider);
		}

		if (await isTauriWithAfm()) {
			const { AFMProvider } = await import("./AFMProvider.ts");
			providers.push(AFMProvider);
		}

		return providers;
	},

	getProviderStateCache: async (user: zUser, update = false) => {
		const { providers } = await trpc.user.getCache.query({ update });

		if (user.settings.useBrowserModels) {
			const { WebLLMProvider } = await import("./WebLLMProvider.ts");
			providers.push({
				...WebLLMProvider,
				status: await WebLLMProvider.getStatus({ user }),
			} satisfies ProviderState<ModelProviderStatus>);
		}

		if (await isTauriWithAfm()) {
			const { AFMProvider } = await import("./AFMProvider.ts");
			providers.push({
				...AFMProvider,
				status: await AFMProvider.getStatus({ user }),
			} satisfies ProviderState<ModelProviderStatus>);
		}

		return providers;
	},
} as const;
