import { query, queryClient, trpc } from '@/utils/api';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { Chat } from '@tiny-chat/backend/generated/prisma/client.ts';
import { useChatStore } from '../stores/useChatStore';
import type { MessageState } from '@tiny-chat/shared/src/types/chat';
import { refetchChatList } from './useChatList';
import { ChatService } from '../services/ChatService';

export type ChatState = Chat & { unseen: boolean };

export function getChatTimestamp(chat: Awaited<ReturnType<typeof trpc.chat.find.query>>) {
  if (!chat) return -1;
  return Math.max(
    chat.createdAt.getTime(),
    ...(chat.messages as { createdAt: Date }[]).map((m) => m.createdAt.getTime()),
  );
}

export async function refetchActiveChat(chatId: string) {
  await queryClient.invalidateQueries({
    queryKey: query.chat.pathKey(),
  });
  useChatStore.getState().setLastSeen(chatId, new Date().getTime());
}

export const useChat = () => {
  const chatId = useChatStore((s) => s.chatId);
  const lastSeen = useChatStore((s) => s.lastSeen);

  const chat = useQuery({
    ...query.chat.find.queryOptions(
      { id: chatId },
      {
        enabled: !!chatId,
        select: (data): ChatState | null => {
          if (!data) return null;
          if (!(data.id in lastSeen)) {
            useChatStore.getState().setLastSeen(data.id, getChatTimestamp(data));
          }
          return {
            ...data,
            unseen: getChatTimestamp(data) > lastSeen[data.id],
          };
        },
        initialData: queryClient
          .getQueryData(query.chat.list.infiniteQueryKey({ limit: 10 }))
          ?.pages.flatMap((page) => page.folders)
          .flatMap((folder) => folder.chats)
          .find((chat) => chat.id === chatId),
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    ),
  });

  const forkChat = useMutation({
    mutationFn: async ({ chat, atMessage }: { chat: ChatState; atMessage: MessageState }) => {
      return trpc.chat.clone.mutate({
        id: chat.id,
        untilMessageId: atMessage.id,
        title: `Fork of ${chat.title ?? 'Forked Chat'}`,
      });
    },
    onSuccess: async (clone, input) => {
      await refetchChatList();
      if (input.chat.id === chatId) ChatService.setChatId(clone.id);
    },
  });

  return { chat, forkChat };
};
