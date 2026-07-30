import { useInfiniteQuery } from "@tanstack/react-query";
import {
	tRPCQuery,
	tRPCQueryClient,
} from "../../../core/services/tRPCService.ts";
import { useChat } from "./useChat.ts";

export const refetchMessages = async () => {
	return tRPCQueryClient.invalidateQueries({
		queryKey: tRPCQuery.message.pathKey(),
	});
};

export const useMessages = () => {
	const { chat } = useChat();

	const messages = useInfiniteQuery({
		...tRPCQuery.message.getMessages.infiniteQueryOptions(
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
