import { useInfiniteQuery } from "@tanstack/react-query";
import { useChat } from "#frontend/features/chat/hooks/useChat.ts";
import { useChatStore } from "#frontend/features/chat/stores/useChatStore.ts";
import { query, queryClient } from "#frontend/utils/api.ts";

export const refetchMessages = async (chatId?: string) => {
	if (chatId) useChatStore.getState().setLastSeen(chatId, Date.now());
	return queryClient.invalidateQueries({
		queryKey: query.message.pathKey(),
	});
};

export const useMessages = () => {
	const { chat } = useChat();

	const messages = useInfiniteQuery({
		...query.message.getMessages.infiniteQueryOptions(
			{ chat: chat.data, limit: 5 },
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

	return { messages };
};
