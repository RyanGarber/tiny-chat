import { queryClient, query } from '@/utils/api';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useChat } from '@/features/chat/hooks/useChat';
import { useChatStore } from '@/features/chat/stores/useChatStore';

export const refetchMessages = async (chatId?: string) => {
  if (chatId) useChatStore.getState().setLastSeen(chatId, new Date().getTime());
  return queryClient.invalidateQueries({
    queryKey: query.messages.pathKey(),
  });
};

export const useMessages = () => {
  const { chat } = useChat();

  const messages = useInfiniteQuery({
    ...query.messages.listInfinite.infiniteQueryOptions(
      { chatId: chat.data?.id, limit: 5 },
      {
        getNextPageParam: (lastPage, _pages) => lastPage.nextCursor,
        select: (data) => {
          return {
            pages: [...data.pages].reverse(),
            pageParams: [...data.pageParams].reverse(),
          };
        },
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    ),
  });

  return messages;
};
