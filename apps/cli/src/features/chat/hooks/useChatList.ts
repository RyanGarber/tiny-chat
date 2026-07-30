import { useInfiniteQuery } from "@tanstack/react-query";
import { tRPCQuery } from "../../../core/services/tRPCService.ts";

export const useChatList = () => {
	const folders = useInfiniteQuery({
		...tRPCQuery.chat.getChatList.infiniteQueryOptions(
			{ limit: 10 },
			{
				getNextPageParam: (lastPage, _pages) => lastPage.nextCursor,
				select: (data) => {
					return {
						pages: data.pages,
						pageParams: data.pageParams,
					};
				},
				staleTime: 600000,
				refetchOnWindowFocus: false,
				refetchOnReconnect: false,
			},
		),
	});

	return { folders };
};
