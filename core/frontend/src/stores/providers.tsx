import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { ChatProviderStatus, OtherProviderStatus, SearchProviderStatus } from '@tiny-chat/core-backend/src/types.ts';
import { trpc } from '@/utils/api';
import { reloadConfig } from '@/managers/configuration';
import { useTasks } from '@/stores/tasks.tsx';

interface ProvidersCache {
  chat: ChatProviderStatus[];
  search: SearchProviderStatus[];
  other: OtherProviderStatus[];
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
  otherProviders: OtherProviderStatus[];
  updateProviders: () => Promise<void>;

  abortController: AbortController | null;
}

export const useProviders = create(
  subscribeWithSelector<Providers>((set, get) => ({
    init: async () => {
      const cached = readProvidersCache();
      if (cached) {
        set({ chatProviders: cached.chat, searchProviders: cached.search, otherProviders: cached.other ?? [] });
        reloadConfig();
        return;
      }
      await get().updateProviders();
    },

    chatProviders: [],
    searchProviders: [],
    otherProviders: [],
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
      writeProvidersCache({ chat: providers.chat, search: providers.search, other: providers.other });
      set({ chatProviders: providers.chat, searchProviders: providers.search, otherProviders: providers.other });
      reloadConfig();

      void useTasks.getState().removeTask('providers');
    },

    abortController: null,
  })),
);
