import { isTauriWithAfm, trpc } from '@/utils/api';
import { chatProviders } from '@tiny-chat/shared/src/providers/chat';
import type { zUser } from '@tiny-chat/shared/src/types/user';

export const ProviderService = {
  getChatProviders: async (user: zUser) => {
    const providers = [...chatProviders];
    if (user.settings.useBrowserModels) {
      const { WebLLMProvider } = await import('./WebLLMProvider');
      providers.push(WebLLMProvider);
    }
    if (await isTauriWithAfm()) {
      const { AFMProvider } = await import('./AFMProvider');
      providers.push(AFMProvider);
    }
    return providers;
  },

  getChatProviderCache: async (user: zUser) => {
    const { providers } = await trpc.user.getCache.query();
    if (user.settings.useBrowserModels) {
      const { WebLLMProvider } = await import('./WebLLMProvider');
      providers.chat.push({
        ...WebLLMProvider,
        models: await WebLLMProvider.getModels(user),
      });
    }
    if (await isTauriWithAfm()) {
      const { AFMProvider } = await import('./AFMProvider');
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
