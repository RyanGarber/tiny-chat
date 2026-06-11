import { trpc } from '@/utils/api';
import { chatProviders } from '@tiny-chat/shared/src/providers/chat';
import { zUser } from '@tiny-chat/shared/src/types/user';

export const ProviderService = {
  getChatProviders: async () => {
    // TODO - toggle for enabling WebLLMProvider
    const { WebLLMProvider } = await import('./WebLLMProvider');
    return [...chatProviders, WebLLMProvider];
  },

  getChatProviderCache: async (user: zUser) => {
    const { providers } = await trpc.user.getCache.query();
    // TODO - toggle for enabling WebLLMProvider
    const { WebLLMProvider } = await import('./WebLLMProvider');
    providers.chat.push({
      ...WebLLMProvider,
      models: await WebLLMProvider.getModels(user),
    });
    return providers;
  },

  updateProviderCache: async () => {
    const cache = await trpc.user.updateCache.mutate();
    return cache.providers;
  },
} as const;
