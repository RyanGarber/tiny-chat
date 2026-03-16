import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { ChatProviderStatus, SearchProviderStatus } from '@tiny-chat/core-backend/src/types.ts';
import { trpc } from '@/utils/api';
import { reloadConfig } from '@/managers/configuration';
import { useTasks } from '@/stores/tasks.tsx';

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
      set({ chatProviders: providers.chat, searchProviders: providers.search });
      reloadConfig();

      void useTasks.getState().removeTask('providers');
    },

    abortController: null,
  })),
);
