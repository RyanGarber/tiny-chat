import { useInfiniteQuery } from "@tanstack/react-query";
import { client } from "../../../client.ts";
import { useChatStore } from "../stores/useChatStore.ts";

export const refetchMessages = async () => {
	return client.queryClient.invalidateQueries({
		queryKey: client.query.message.pathKey(),
	});
};

export const useMessages = () => {
	const chatId = useChatStore((state) => state.chatId);

	const messages = useInfiniteQuery({
		...client.query.message.getMessages.infiniteQueryOptions(
			{ chat: chatId, limit: 5 },
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
