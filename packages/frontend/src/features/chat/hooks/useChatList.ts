import { queryClient, query, trpc } from '@/utils/api';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { getChatTimestamp, type ChatState } from '@/features/chat/hooks/useChat';
import { useChatStore } from '../stores/useChatStore';
import { ChatService } from '../services/ChatService';

export const refetchChatList = () => {
  return queryClient.invalidateQueries({
    queryKey: query.folders.pathKey(),
  });
};

export const useChatList = () => {
  const lastSeen = useChatStore((s) => s.lastSeen);
  const chatId = useChatStore((s) => s.chatId);

  const folders = useInfiniteQuery({
    ...query.folders.list.infiniteQueryOptions(
      { limit: 10 },
      {
        getNextPageParam: (lastPage, _pages) => lastPage.nextCursor,
        select: (data) => {
          return {
            pages: data.pages.map((page) => ({
              ...page,
              folders: page.folders.map((folder) => ({
                ...folder,
                chats: folder.chats.map((chat): ChatState => {
                  if (!(chat.id in lastSeen))
                    useChatStore.getState().setLastSeen(chat.id, getChatTimestamp(chat));
                  return {
                    ...chat,
                    unseen: getChatTimestamp(chat) > lastSeen[chat.id],
                  };
                }),
              })),
            })),
            pageParams: data.pageParams,
          };
        },
        staleTime: 600000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    ),
  });

  const deleteChat = useMutation({
    mutationFn: async ({ chat }: { chat: ChatState }) => {
      return trpc.chats.delete.mutate({ id: chat.id });
    },
    onSuccess: async (_, input) => {
      await refetchChatList();
      if (chatId === input.chat.id) ChatService.setChatId(null);
    },
  });

  const renameChat = useMutation({
    mutationFn: async ({ chat, title }: { chat: ChatState; title: string }) => {
      await trpc.chats.edit.mutate({ id: chat.id, title });
    },
    onSuccess: () => refetchChatList(),
  });

  return { folders, deleteChat, renameChat };
};
