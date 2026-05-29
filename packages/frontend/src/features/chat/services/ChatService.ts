import { useTasks } from '@/stores/tasks.tsx';
import type { Chat } from '@tiny-chat/backend/generated/prisma/client.ts';
import { refetchChatList } from '@/features/chat/hooks/useChatList';
import { trpc } from '@/utils/api';
import { setHashbang } from '@/core/hooks/useHashbang';
import { useChatStore } from '@/features/chat/stores/useChatStore';
import { useConfigStore } from '@/features/input/stores/useConfigStore';

export const ChatService = {
  setChatId: (id: string | null) => {
    setHashbang(id);
    useChatStore.getState().setCreateIncognito(false);
    useChatStore.getState().setCreateTemporary(false);
    useConfigStore.getState().setOverrideConfig(null);
  },

  renameChat: async (chat: Chat, title: string) => {
    console.log(`Renaming chat ${chat.id} to ${title}`);
    useTasks.getState().addTask('renameChat', 'Renaming chat');
    await trpc.chats.edit.mutate({ id: chat.id, title });
    await useTasks.getState().updateTask('renameChat', 50);
    await refetchChatList();
    await useTasks.getState().removeTask('renameChat');
  },

  cloneChat: async (chat: Chat, untilMessageId: string) => {
    console.log('Cloning chat at message:', untilMessageId);
    useTasks.getState().addTask('cloneChat', 'Forking chat');
    const clone = await trpc.chats.clone.mutate({
      id: chat.id,
      untilMessageId,
      title: `Fork of ${chat.title ?? 'Chat'}`,
    });
    await useTasks.getState().updateTask('cloneChat', 50);
    await refetchChatList();
    ChatService.setChatId(clone.id);
    await useTasks.getState().removeTask('cloneChat');
  },

  deleteChat: async (chat: Chat, activeChat: Chat | null) => {
    console.log(`Deleting chat ${chat.id}`);
    useTasks.getState().addTask('deleteChat', 'Deleting chat');
    await trpc.chats.delete.mutate({ id: chat.id });
    await useTasks.getState().updateTask('deleteChat', 50);
    await refetchChatList();
    if (activeChat?.id === chat.id) ChatService.setChatId(null);
    await useTasks.getState().removeTask('deleteChat');
  },
} as const;
