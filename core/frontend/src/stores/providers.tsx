import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  ChatProviderStatus,
  OtherProviderStatus,
  WebProviderStatus,
} from '@tiny-chat/core-backend/src/types.ts';
import { trpc } from '@/utils/api';
import { reloadConfig } from '@/managers/configuration';
import { useTasks } from '@/stores/tasks.tsx';

interface ProvidersCache {
  chat: ChatProviderStatus[];
  web: WebProviderStatus[];
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
  webProviders: WebProviderStatus[];
  otherProviders: OtherProviderStatus[];
  updateProviders: () => Promise<void>;

  abortController: AbortController | null;
}

export const useProviders = create(
  subscribeWithSelector<Providers>((set, get) => ({
    init: async () => {
      const cached = readProvidersCache();
      if (cached) {
        set({
          chatProviders: cached.chat ?? [],
          webProviders: cached.web ?? [],
          otherProviders: cached.other ?? [],
        });
        reloadConfig();
        return;
      }
      await get().updateProviders();
    },

    chatProviders: [],
    webProviders: [],
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
      writeProvidersCache({ chat: providers.chat, web: providers.web, other: providers.other });
      set({
        chatProviders: providers.chat,
        webProviders: providers.web,
        otherProviders: providers.other,
      });
      reloadConfig();

      void useTasks.getState().removeTask('providers');
    },

    abortController: null,
  })),
);
