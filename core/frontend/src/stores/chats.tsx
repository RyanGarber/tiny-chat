import { create } from 'zustand';
import { useMessaging } from '@/stores/messaging.tsx';
import { subscribeWithSelector } from 'zustand/middleware';
import { reloadConfig } from '@/managers/configuration';
import { trpc } from '@/utils/api';
import { Chat } from '@tiny-chat/core-backend/generated/prisma/client.ts';
import { MessageOmitted } from '@tiny-chat/core-backend/src/types.ts';
import { navigate } from 'wouter/use-hash-location';
import { nprogress } from '@mantine/nprogress';
import { useTasks } from '@/stores/tasks.tsx';
import { getLastChatActivity } from '@/utils/ui.ts';

interface Chats {
  init: () => Promise<void>;

  folders: Awaited<ReturnType<typeof trpc.folders.list.query>>;
  fetchFolders: (showProgress?: boolean, showActivity?: boolean) => Promise<void>;

  lastActivityMax: number;
  lastChatActivity: Record<string, number>;
  updatedChats: string[];

  fetchChat: (showProgress?: boolean) => Promise<void>;
  currentChat: Chat | null;
  setCurrentChat: (id: string | null, pushState?: boolean, showProgress?: boolean) => Promise<void>;

  renameChat: (id: string, title: string) => Promise<void>;
  cloneChat: (messageId: string) => Promise<void>;
  deleteChat: (id: string) => Promise<void>;

  temporary: boolean;
  setTemporary: (temporary: boolean) => Promise<void>;

  incognito: boolean;
  setIncognito: (incognito: boolean) => Promise<void>;

  messages: MessageOmitted[];
}

export const useChats = create(
  subscribeWithSelector<Chats>((set, get) => ({
    init: async () => {
      await get().fetchFolders();
      setInterval(() => {
        void (async () => {
          try {
            const activityMax = await trpc.folders.lastActivityMax.query();
            const { lastActivityMax, fetchFolders } = get();
            if (lastActivityMax === -1) {
              set({ lastActivityMax: activityMax });
              return;
            }
            if (activityMax > lastActivityMax) {
              console.log(`New chat activity detected (${lastActivityMax} -> ${activityMax}`);
              set({ lastActivityMax: activityMax });
              await fetchFolders(false, true);
            }
          } catch (e) {
            console.error('Failed to poll last activity', e);
          }
        })();
      }, 1000 * 10);
    },

    folders: [],
    fetchFolders: async (showProgress = true, showActivity = false) => {
      if (showProgress) useTasks.getState().addTask('fetchFolders', 'Loading chats');
      const folders = await trpc.folders.list.query();
      const { currentChat } = get();

      console.log('Fetched folders:', folders);

      if (showActivity) {
        for (const chat of folders.flatMap((f) => f.chats)) {
          const lastActivity = getLastChatActivity(chat);
          if (lastActivity !== get().lastChatActivity[chat.id]) {
            console.log(`New activity in chat ${chat.id}, marking updated`);
            set({ updatedChats: [...get().updatedChats.filter((c) => c !== chat.id), chat.id] });
            set({ lastChatActivity: { ...get().lastChatActivity, [chat.id]: lastActivity } });
          }
        }
      } else {
        for (const chat of folders.flatMap((f) => f.chats)) {
          set({
            lastChatActivity: { ...get().lastChatActivity, [chat.id]: getLastChatActivity(chat) },
          });
        }
      }

      set({
        currentChat: currentChat ? await trpc.chats.find.query({ id: currentChat.id }) : null,
        folders: folders,
      });
      if (showProgress) await useTasks.getState().removeTask('fetchFolders');
    },

    lastActivityMax: -1,
    lastChatActivity: {},
    updatedChats: [],

    fetchChat: async (showProgress = true) => {
      const { currentChat, lastChatActivity } = get();

      if (showProgress) useTasks.getState().addTask('fetchChat', 'Loading chat');

      const messages = currentChat
        ? await trpc.messages.list.query({ chatId: currentChat.id })
        : [];
      console.log('Messages:', messages);

      set({
        messages,
        ...(currentChat
          ? {
              lastChatActivity: {
                ...lastChatActivity,
                [currentChat.id]: getLastChatActivity({ ...currentChat, messages }),
              },
              updatedChats: get().updatedChats.filter((c) => c !== currentChat.id),
            }
          : {}),
      });

      if (showProgress) await useTasks.getState().removeTask('fetchChat');
    },

    currentChat: null,
    setCurrentChat: async (id, pushState = true, showProgress = true) => {
      if (showProgress) nprogress.start();

      const chat = await trpc.chats.find.query({ id: id! });
      if (id && !chat) {
        if (showProgress) nprogress.complete();
        return;
      }

      if (pushState) navigate(id ? `/${id}` : '/');
      useMessaging.getState().reset();
      set({ currentChat: chat });

      if (showProgress) nprogress.set(50);

      await get().fetchChat(false);
      useMessaging.getState().requestScrollToBottom();
      if (pushState) reloadConfig();

      if (showProgress) nprogress.complete();
    },

    renameChat: async (id, name) => {
      const { fetchFolders } = get();
      useTasks.getState().addTask('renameChat', 'Renaming chat');
      await trpc.chats.edit.mutate({ id: id, title: name });
      await useTasks.getState().updateTask('renameChat', 50);
      await fetchFolders(false);
      await useTasks.getState().removeTask('renameChat');
    },
    cloneChat: async (untilMessageId) => {
      const { currentChat, setCurrentChat, fetchFolders } = get();
      console.log('Cloning chat at message:', untilMessageId);
      useTasks.getState().addTask('cloneChat', 'Forking chat');
      const chat = await trpc.chats.clone.mutate({
        id: currentChat!.id,
        untilMessageId,
        title: `Fork of ${currentChat!.title}`,
      });
      await useTasks.getState().updateTask('cloneChat', 33);
      await fetchFolders(false);
      await useTasks.getState().updateTask('cloneChat', 66);
      await setCurrentChat(chat.id, true, false);
      await useTasks.getState().removeTask('cloneChat');
    },
    deleteChat: async (id) => {
      const { currentChat, setCurrentChat, fetchFolders } = get();
      console.log(`Deleting chat ${id}`);
      const isCurrent = id === currentChat?.id;
      if (isCurrent) useTasks.getState().addTask('deleteChat', 'Deleting chat');
      await trpc.chats.delete.mutate({ id: id });
      if (isCurrent) await useTasks.getState().updateTask('deleteChat', 33);
      await fetchFolders(false);
      if (isCurrent) await useTasks.getState().updateTask('deleteChat', 66);
      if (currentChat?.id === id) await setCurrentChat(null, true, false);
      if (isCurrent) await useTasks.getState().removeTask('deleteChat');
    },

    temporary: false,
    setTemporary: async (temporary) => {
      const { currentChat, setCurrentChat } = useChats.getState();
      if (currentChat) await setCurrentChat(null);
      set({ temporary });
    },

    incognito: false,
    setIncognito: async (incognito) => {
      const { currentChat, setCurrentChat } = useChats.getState();
      if (currentChat) await setCurrentChat(null);
      set({ incognito });
    },

    messages: [],
  })),
);
