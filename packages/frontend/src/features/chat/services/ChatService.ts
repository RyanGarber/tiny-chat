import { useMessaging } from '@/stores/messaging.tsx';
import { useLayout } from '@/stores/layout.tsx';
import { useTasks } from '@/stores/tasks.tsx';
import { alert } from '@/utils/ui';
import { GenerateService } from '@/features/message/services/GenerateService';
import type { MessageState, zConfig, zData } from '@tiny-chat/shared/src/types/chat.ts';
import type { Chat } from '@tiny-chat/backend/generated/prisma/client.ts';
import { refetchChatList } from '@/features/chat/hooks/useChatList';
import { trpc } from '@/utils/api';
import { setHashbang } from '@/core/hooks/useHashbang';
import { refetchMessages } from '@/features/message/hooks/useMessages';
import { useChatStore } from '@/features/chat/stores/useChatStore';
import { useConfigStore } from '@/features/input/stores/useConfigStore';
import type { ToolGroup } from '@tiny-chat/shared/src/types/tool.ts';
import type { zSkill } from '@tiny-chat/shared/src/types/skill.ts';
import type { zCache } from '@tiny-chat/shared/src/types/user';

export const ChatService = {
  setChatId: (id: string | null) => {
    setHashbang(id);
    useChatStore.getState().setCreateIncognito(false);
    useChatStore.getState().setCreateTemporary(false);
    useConfigStore.getState().setOverrideConfig(null);
  },

  sendMessage: async (
    data: zData,
    config: zConfig,
    activeChat: Chat | null,
    tools: ToolGroup[],
    skills: zSkill[],
    providers: zCache['providers'],
  ) => {
    const { setMessagingDisable } = useLayout.getState();
    const { truncating, reset, editing, setData, insertingAfter } = useMessaging.getState();
    const { createTemporary, createIncognito } = useChatStore.getState();

    useTasks.getState().addTask('sending', 'Sending message');
    setMessagingDisable('sendMessage', true);
    reset();
    useChatStore.setState({ createTemporary: false, createIncognito: false });

    try {
      await GenerateService.onUserMessage({
        data,
        config,
        activeChat,
        editing,
        truncating,
        insertingAfter,
        temporary: createTemporary,
        incognito: createIncognito,
        tools,
        skills,
        providers,
        onPrepared: () => {
          void useTasks.getState().removeTask('sending');
          setMessagingDisable('sendMessage', false);
        },
      });
    } catch (e) {
      alert('error', 'Failed to send message');
      setData(data);
      throw e;
    } finally {
      void useTasks.getState().removeTask('sending');
      setMessagingDisable('sendMessage', false);
    }
  },

  deleteMessagePair: async (message: MessageState, activeChat: Chat | null): Promise<void> => {
    console.log(`Deleting message pair ${message.id}`);
    const { setMessagingDisable } = useLayout.getState();
    setMessagingDisable('deleteMessagePair', true);
    useTasks.getState().addTask('deleteMessagePair', 'Deleting message');
    try {
      const chatDeleted = await trpc.messages.delete.mutate({ id: message.id });
      void useTasks.getState().updateTask('deleteMessagePair', 100);
      await refetchMessages();
      if (chatDeleted) {
        await refetchChatList();
        if (activeChat?.id === message.chatId) ChatService.setChatId(null);
      }
    } finally {
      await useTasks.getState().removeTask('deleteMessagePair');
      setMessagingDisable('deleteMessagePair', false);
    }
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
