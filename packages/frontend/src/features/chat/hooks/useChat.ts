import { useMessaging } from '@/stores/messaging';
import { queryClient, query, type trpc } from '@/utils/api';
import { useQuery } from '@tanstack/react-query';
import type { Chat } from '@tiny-chat/backend/generated/prisma/client.ts';
import { useChatStore } from '../stores/useChatStore';

export type ChatState = Chat & { unseen: boolean };

export function getChatTimestamp(chat: Awaited<ReturnType<typeof trpc.chats.find.query>>) {
  if (!chat) return -1;
  return Math.max(
    chat.createdAt.getTime(),
    ...(chat.messages as { createdAt: Date }[]).map((m) => m.createdAt.getTime()),
  );
}

export async function refetchActiveChat(chatId: string) {
  await queryClient.invalidateQueries({
    queryKey: query.chats.pathKey(),
  });
  useChatStore.getState().setLastSeen(chatId, new Date().getTime());
  useMessaging.getState().requestScrollInstant();
}

export const useChat = () => {
  const chatId = useChatStore((s) => s.chatId);
  const lastSeen = useChatStore((s) => s.lastSeen);

  const chat = useQuery({
    ...query.chats.find.queryOptions(
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
          .getQueryData(query.folders.list.infiniteQueryKey({ limit: 10 }))
          ?.pages.flatMap((page) => page.folders)
          .flatMap((folder) => folder.chats)
          .find((chat) => chat.id === chatId),
        refetchOnWindowFocus: false,
      },
    ),
  });

  return chat;
};
