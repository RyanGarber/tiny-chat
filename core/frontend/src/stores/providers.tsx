import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { trpc } from '@/utils/api';
import { reloadConfig } from '@/managers/configuration';
import { useTasks } from '@/stores/tasks.tsx';
import { zCache } from '@tiny-chat/core-backend/src/types.ts';

interface Providers {
  init: () => Promise<void>;

  providers: zCache['providers'];
  updateProviders: () => Promise<void>;

  abortController: AbortController | null;
}

export const useProviders = create(
  subscribeWithSelector<Providers>((set, get) => ({
    init: async () => {
      set({ providers: await trpc.providers.list.query({ update: false }) });
      reloadConfig();
    },

    providers: zCache.parse({}).providers,
    updateProviders: async () => {
      useTasks.getState().addTask('providers', 'Checking availability');

      set({ providers: await trpc.providers.list.query({ update: true }) });

      const chatModels = get().providers.chat.reduce((acc, s) => acc + s.models.length, 0);
      void useTasks
        .getState()
        .updateTask('providers', 100, `Found ${chatModels} model${chatModels === 1 ? '' : 's'}`);
      reloadConfig();

      void useTasks.getState().removeTask('providers');
    },

    abortController: null,
  })),
);
