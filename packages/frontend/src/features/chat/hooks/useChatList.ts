import { queryClient, query } from '@/utils/api';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getChatTimestamp, type ChatState } from '@/features/chat/hooks/useChat';
import { useChatStore } from '../stores/useChatStore';

export const refetchChatList = () => {
  return queryClient.invalidateQueries({
    queryKey: query.folders.pathKey(),
  });
};

export const useChatList = () => {
  const lastSeen = useChatStore((s) => s.lastSeen);

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
        refetchInterval: 600000,
      },
    ),
  });

  return folders;
};
