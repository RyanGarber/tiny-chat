import { create } from 'zustand';
import { useMessaging } from '@/stores/messaging.tsx';
import { subscribeWithSelector } from 'zustand/middleware';
import { reloadConfig } from '@/managers/configuration';
import { trpc } from '@/utils/api';
import { Action, Chat } from '@tiny-chat/core-backend/generated/prisma/client.ts';
import { MessageOmitted } from '@tiny-chat/core-backend/src/types.ts';
import { FolderListData } from '@tiny-chat/core-backend/src/routes/folders.ts';
import { navigate } from 'wouter/use-hash-location';
import { nprogress } from '@mantine/nprogress';
import { useTasks } from '@/stores/tasks.tsx';

interface Chats {
  init: () => Promise<void>;
  lastActivityDate: number;

  folders: FolderListData[];
  fetchFolders: (showProgress?: boolean) => Promise<void>;
  messages: MessageOmitted[];
  actions: Action[];
  fetchChat: (showProgress?: boolean) => Promise<void>;

  currentChat: Chat | null;
  setCurrentChat: (id: string | null, pushState?: boolean, showProgress?: boolean) => Promise<void>;

  initialLoadComplete: boolean;
  clientLastViewedAt: Record<string, number>;

  renameChat: (id: string, title: string) => Promise<void>;
  cloneChat: (messageId: string) => Promise<void>;
  deleteChat: (id: string) => Promise<void>;

  temporary: boolean;
  setTemporary: (temporary: boolean) => Promise<void>;

  incognito: boolean;
  setIncognito: (incognito: boolean) => Promise<void>;
}

export const useChats = create(
  subscribeWithSelector<Chats>((set, get) => ({
    lastActivityDate: 0,
    init: async () => {
      await get().fetchFolders();
      setInterval(async () => {
        try {
          const current = await trpc.folders.lastActivity.query();
          const { lastActivityDate, fetchFolders } = get();
          if (lastActivityDate === 0) {
            set({ lastActivityDate: current });
            return;
          }
          if (current > lastActivityDate) {
            set({ lastActivityDate: current });
            await fetchFolders(false);
          }
        } catch (e) {
          console.error("Failed to poll last activity", e);
        }
      }, 1000 * 10);
    },

    folders: [],
    initialLoadComplete: false,
    clientLastViewedAt: {},
    fetchFolders: async (showProgress = true) => {
      if (showProgress) useTasks.getState().addTask('fetchFolders', 'Loading chats');
      const chats = await trpc.folders.list.query();
      const { currentChat, initialLoadComplete, clientLastViewedAt } = get();
      
      const newClientLastViewedAt = { ...clientLastViewedAt };
      for (const folder of chats) {
        for (const chat of folder.chats) {
          if (newClientLastViewedAt[chat.id] === undefined) {
             newClientLastViewedAt[chat.id] = initialLoadComplete ? 0 : chat.updatedAt.getTime();
          }
        }
      }

      set({
        currentChat: currentChat ? await trpc.chats.find.query({ id: currentChat.id }) : null,
        folders: chats,
        clientLastViewedAt: newClientLastViewedAt,
        initialLoadComplete: true,
      });
      if (showProgress) await useTasks.getState().removeTask('fetchFolders');
    },
    messages: [],
    actions: [],
    fetchChat: async (showProgress = true) => {
      const { currentChat } = get();
      if (showProgress) useTasks.getState().addTask('fetchChat', 'Loading chat');
      const messages = currentChat
        ? await trpc.messages.list.query({ chatId: currentChat.id })
        : [];
      const actions = currentChat ? await trpc.actions.list.query({ chatId: currentChat.id }) : [];
      console.log('Messages:', messages, 'Actions:', actions);
      set({ messages, actions });
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
      
      const updates: Partial<Chats> = { currentChat: chat };
      if (id) {
        updates.clientLastViewedAt = { ...get().clientLastViewedAt, [id]: Date.now() };
      }
      set(updates);
      
      if (showProgress) nprogress.set(50);
      await get().fetchChat(false);
      useMessaging.getState().requestScrollToBottom();
      if (showProgress) nprogress.complete();
      if (pushState) reloadConfig();
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
  })),
);
