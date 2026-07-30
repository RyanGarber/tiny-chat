import type { zUser } from "#core/features/data/types/user.ts";
import { ModelProviderService } from "#core/features/provider/services/ModelProviderService.ts";
import type {
	ModelProvider,
	ModelProviderStatus,
} from "#core/features/provider/types/model.ts";
import type { ProviderState } from "#core/features/provider/types/provider.ts";
import { client } from "#ui/client.ts";
import { TauriUtils } from "#ui/features/tauri/utils/TauriUtils.ts";

export const ProviderService = {
	getModelProviders: async (user: zUser) => {
		const providers: ModelProvider<any>[] = [...ModelProviderService.providers];

		if (user.settings.useBrowserModels) {
			const { WebLLMProvider } = await import("./WebLLMProvider.ts");
			providers.push(WebLLMProvider);
		}

		if (await TauriUtils.isTauriWithAfm()) {
			const { AFMProvider } = await import("./AFMProvider.ts");
			providers.push(AFMProvider);
		}

		return providers;
	},

	getProviderStateCache: async (user: zUser, update = false) => {
		const { providers } = await client.api.user.getCache.query({ update });

		if (user.settings.useBrowserModels) {
			const { WebLLMProvider } = await import("./WebLLMProvider.ts");
			providers.push({
				...WebLLMProvider,
				status: await WebLLMProvider.getStatus({ user }),
			} satisfies ProviderState<ModelProviderStatus>);
		}

		if (await TauriUtils.isTauriWithAfm()) {
			const { AFMProvider } = await import("./AFMProvider.ts");
			providers.push({
				...AFMProvider,
				status: await AFMProvider.getStatus({ user }),
			} satisfies ProviderState<ModelProviderStatus>);
		}

		return providers;
	},
} as const;
