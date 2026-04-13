import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { ChatProviderStatus, SearchProviderStatus } from '@tiny-chat/core-backend/src/types.ts';
import { trpc } from '@/utils/api';
import { reloadConfig } from '@/managers/configuration';
import { useTasks } from '@/stores/tasks.tsx';

interface ProvidersCache {
  chat: ChatProviderStatus[];
  search: SearchProviderStatus[];
}

function readProvidersCache(): ProvidersCache | null {
  try {
    const raw = localStorage.getItem('providers');
    if (!raw) return null;
    return JSON.parse(raw) as ProvidersCache;
  } catch {
    return null;
  }
}

function writeProvidersCache(data: ProvidersCache): void {
  try {
    localStorage.setItem('providers', JSON.stringify(data));
  } catch {
    // storage quota exceeded or unavailable – ignore
  }
}

interface Providers {
  init: () => Promise<void>;

  chatProviders: ChatProviderStatus[];
  searchProviders: SearchProviderStatus[];
  updateProviders: () => Promise<void>;

  abortController: AbortController | null;
}

export const useProviders = create(
  subscribeWithSelector<Providers>((set, get) => ({
    init: async () => {
      const cached = readProvidersCache();
      if (cached) {
        set({ chatProviders: cached.chat, searchProviders: cached.search });
        reloadConfig();
        return;
      }
      await get().updateProviders();
    },

    chatProviders: [],
    searchProviders: [],
    updateProviders: async () => {
      useTasks.getState().addTask('providers', 'Checking availability');

      const providers = await trpc.providers.list.query();

      const chatProviderModels = providers.chat.reduce((acc, s) => acc + s.models.length, 0);
      void useTasks
        .getState()
        .updateTask(
          'providers',
          100,
          `Found ${chatProviderModels} model${chatProviderModels === 1 ? '' : 's'}`,
        );

      console.log('Updated providers:', providers);
      writeProvidersCache({ chat: providers.chat, search: providers.search });
      set({ chatProviders: providers.chat, searchProviders: providers.search });
      reloadConfig();

      void useTasks.getState().removeTask('providers');
    },

    abortController: null,
  })),
);
