import { useMessaging } from '@/stores/messaging';
import { useMutation } from '@tanstack/react-query';
import type { MessageState, zData, zDataPart } from '@tiny-chat/shared/src/types/chat';
import { useChatStore } from '../stores/useChatStore';
import { GenerateService } from '@/features/message/services/GenerateService';
import { useProviders } from '@/features/input/hooks/useProviders';
import { useSkills } from '@/features/input/hooks/useSkills';
import { useTools } from '@/features/input/hooks/useTools';
import { useChat } from './useChat';
import { useConfig } from '@/features/input/hooks/useConfig';
import { serialize } from '@/slate/serializer';
import { useRef } from 'react';
import { trpc } from '@/utils/api';
import { refetchMessages } from '@/features/message/hooks/useMessages';
import { refetchChatList } from './useChatList';
import { ChatService } from '../services/ChatService';

export const sendMessageMutationKey = ['send-message'] as const;
export const deleteMessageMutationKey = ['delete-message'] as const;

export const useSend = () => {
  const activeChat = useChat();
  const { toolGroups } = useTools();
  const { skills } = useSkills();
  const { providers } = useProviders();
  const { config } = useConfig();

  const deletingChatId = useRef<string | undefined>(undefined);

  const deleteMessage = useMutation({
    mutationKey: deleteMessageMutationKey,
    mutationFn: async (message: MessageState) => {
      deletingChatId.current = message.chatId;
      return await trpc.messages.delete.mutate({ id: message.id });
    },
    onSuccess: async (chatDeleted, message) => {
      void refetchMessages(deletingChatId.current);
      if (chatDeleted) {
        await refetchChatList();
        if (deletingChatId.current === message.chatId) ChatService.setChatId(null);
      }
    },
  });

  const sendingData = useRef<zData | undefined>(undefined);

  const sendMessage = useMutation({
    mutationKey: sendMessageMutationKey,
    mutationFn: async () => {
      const { truncating, editing, insertingAfter, uploads, reset } = useMessaging.getState();
      const { createTemporary, createIncognito } = useChatStore.getState();

      const data: zDataPart[] = [...uploads];
      if (serialize().trim().length) data.push({ type: 'text', value: serialize() });
      if (!data.length) return;

      sendingData.current = [data];

      reset();
      useChatStore.setState({ createTemporary: false, createIncognito: false });

      await GenerateService.onUserMessage({
        data: [data],
        config,
        activeChat: activeChat.data ?? null,
        editing,
        truncating,
        insertingAfter,
        temporary: createTemporary,
        incognito: createIncognito,
        tools: toolGroups ?? [],
        skills: skills ?? [],
        providers: providers.data!,
      });
    },

    onError: () => {
      const { setData } = useMessaging.getState();
      if (sendingData.current) {
        setData([...sendingData.current]);
      }
    },
  });

  return { sendMessage, deleteMessage };
};
