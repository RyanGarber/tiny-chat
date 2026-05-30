import { useMessagingStore } from '@/features/chat/stores/useMessagingStore';
import { useMutation } from '@tanstack/react-query';
import {
  Author,
  type MessageState,
  type zData,
  type zDataPart,
} from '@tiny-chat/shared/src/types/chat';
import { useChatStore } from '../stores/useChatStore';
import { GenerateService } from '@/features/message/services/GenerateService';
import { useProviders } from '@/features/input/hooks/useProviders';
import { useSkills } from '@/features/input/hooks/useSkills';
import { useTools } from '@/features/input/hooks/useTools';
import { useConfig } from '@/features/input/hooks/useConfig';
import { serialize } from '@/features/slate/serializer';
import { useRef } from 'react';
import { trpc } from '@/utils/api';
import { refetchMessages } from '@/features/message/hooks/useMessages';
import { refetchChatList } from './useChatList';
import { ChatService } from '../services/ChatService';
import { scrubText } from '@/utils/text';
import { texts } from '@tiny-chat/shared/src/utils';

export const sendMessageMutationKey = ['send-message'] as const;
export const deleteMessageMutationKey = ['delete-message'] as const;

export const useSend = () => {
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

  const sendingData = useRef<{ data: zData; temporary: boolean; incognito: boolean } | undefined>(
    undefined,
  );

  const sendMessage = useMutation({
    mutationKey: sendMessageMutationKey,
    mutationFn: async () => {
      const { truncating, editing, insertingAfter, uploads, reset } = useMessagingStore.getState();
      const { createTemporary, createIncognito } = useChatStore.getState();

      const data: zDataPart[] = [...uploads];
      if (serialize().trim().length) data.push({ type: 'text', value: serialize() });
      if (!data.length) return;

      sendingData.current = {
        data: [data],
        temporary: createTemporary,
        incognito: createIncognito,
      };

      reset();
      useChatStore.setState({ createTemporary: false, createIncognito: false });

      const chatId = useChatStore.getState().chatId ?? undefined;
      const message = editing
        ? await trpc.messages.edit.mutate({
            id: editing.id,
            author: editing.author,
            config: config,
            data: [data],
            metadata: [],
            truncate: truncating ?? false,
          })
        : await trpc.messages.create.mutate({
            chatId,
            author: Author.USER,
            config: config,
            data: [data],
            metadata: [],
            previousId: insertingAfter?.id,
            temporary: createTemporary,
            incognito: createIncognito,
          });

      if (!chatId) {
        ChatService.setChatId(message.chatId);
        const title = scrubText(texts([data], ' '), 100);
        void (async () => {
          await trpc.chats.edit.mutate({ id: message.chatId, title });
          await refetchChatList();
        })();
      } else {
        await refetchMessages(message.chatId);
      }

      await GenerateService.handle({
        message,
        activeChat: (await trpc.chats.find.query({ id: message.chatId }))!,
        tools: toolGroups,
        providers: providers.data!,
        skills,
      });
    },

    onError: () => {
      const { setData } = useMessagingStore.getState();
      if (sendingData.current) {
        setData([...sendingData.current.data]);
        useChatStore.setState({
          createTemporary: sendingData.current.temporary,
          createIncognito: sendingData.current.incognito,
        });
      }
    },
  });

  return { sendMessage, deleteMessage };
};
