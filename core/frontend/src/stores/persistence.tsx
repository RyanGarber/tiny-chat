import { Action, Memory } from '@tiny-chat/core-backend/generated/prisma/client.ts';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { trpc } from '@/utils/api.ts';
import { getNextRunAt } from '@tiny-chat/core-backend/src/types.ts';

interface Persistence {
  init: () => void;

  actions: (Action & { nextRunAt: Date | null })[];
  fetchActions: () => Promise<void>;

  memories: Memory[];
  fetchMemories: () => Promise<void>;
}

export const usePersistence = create(
  subscribeWithSelector<Persistence>((set, get) => ({
    init: () => {
      void get().fetchActions();
      void get().fetchMemories();
    },

    actions: [],
    fetchActions: async () => {
      const actions = await trpc.persistence.listActions.query();
      console.log('Fetched actions:', actions);
      set({
        actions: await Promise.all(
          actions.map(async (a) => ({
            ...a,
            nextRunAt: await getNextRunAt(a),
          })),
        ),
      });
    },

    memories: [],
    fetchMemories: async () => {
      const memories = await trpc.persistence.listMemories.query();
      console.log('Fetched memories:', memories);
      set({ memories });
    },
  })),
);
