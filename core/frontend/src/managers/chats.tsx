import { create } from 'zustand';
import { reloadConfig, useMessaging } from '@/managers/messaging.tsx';
import { subscribeWithSelector } from 'zustand/middleware';
import { trpc } from '@/utils.ts';
import { Action, Chat } from '@tiny-chat/core-backend/generated/prisma/client.ts';
import { MessageOmitted } from '@tiny-chat/core-backend/src/types.ts';
import { FolderListData } from '@tiny-chat/core-backend/src/routes/folders.ts';
import { navigate } from 'wouter/use-hash-location';
import { nprogress } from '@mantine/nprogress';
import { useTasks } from '@/managers/tasks.tsx';

interface Chats {
  init: () => Promise<void>;

  folders: FolderListData[];
  fetchFolders: (showProgress?: boolean) => Promise<void>;
  messages: MessageOmitted[];
  actions: Action[];
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
}

export const useChats = create(
  subscribeWithSelector<Chats>((set, get) => ({
    init: async () => {
      await get().fetchFolders();
    },

    folders: [],
    fetchFolders: async (showProgress = true) => {
      if (showProgress) useTasks.getState().addTask('fetchFolders', 'Loading chats');
      const chats = await trpc.folders.list.query();
      const { currentChat } = get();
      set({
        currentChat: currentChat ? await trpc.chats.find.query({ id: currentChat.id }) : null,
      });
      set({ folders: chats });
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
      set({ currentChat: chat });
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
