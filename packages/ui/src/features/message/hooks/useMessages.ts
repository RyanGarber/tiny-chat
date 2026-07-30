import { useInfiniteQuery } from "@tanstack/react-query";
import { client } from "#ui/client.ts";
import { useChat } from "#ui/features/chat/hooks/useChat.ts";
import { useChatStore } from "#ui/features/chat/stores/useChatStore.ts";

export const refetchMessages = async (chatId?: string) => {
	if (chatId) useChatStore.getState().setLastSeen(chatId, Date.now());
	return client.queryClient.invalidateQueries({
		queryKey: client.query.message.pathKey(),
	});
};

export const useMessages = () => {
	const { chat } = useChat();

	const messages = useInfiniteQuery({
		...client.query.message.getMessages.infiniteQueryOptions(
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
