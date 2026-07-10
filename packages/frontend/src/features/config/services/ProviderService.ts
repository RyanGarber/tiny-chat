import { isTauriWithAfm, trpc } from "#frontend/utils/api.ts";
import { chatProviders } from "#shared/providers/chat";
import type { zUser } from "#shared/types/user.ts";

export const ProviderService = {
	getChatProviders: async (user: zUser) => {
		const providers = [...chatProviders];
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

	getChatProviderCache: async (user: zUser) => {
		const { providers } = await trpc.user.getCache.query();
		if (user.settings.useBrowserModels) {
			const { WebLLMProvider } = await import("./WebLLMProvider.ts");
			providers.chat.push({
				...WebLLMProvider,
				models: await WebLLMProvider.getModels(user),
			});
		}
		if (await isTauriWithAfm()) {
			const { AFMProvider } = await import("./AFMProvider.ts");
			providers.chat.push({
				...AFMProvider,
				models: await AFMProvider.getModels(user),
			});
		}
		return providers;
	},

	updateProviderCache: async () => {
		const cache = await trpc.user.updateCache.mutate();
		return cache.providers;
	},
} as const;
