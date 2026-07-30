import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { client } from "../../../client.ts";
import { useChatStore } from "../stores/useChatStore.ts";
import { refetchMessages } from "./useMessages.tsx";

export const useChatList = () => {
	const setChatId = useChatStore((s) => s.setChatId);

	const folders = useInfiniteQuery({
		...client.query.chat.getChatList.infiniteQueryOptions(
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

	const setChat = useMutation({
		mutationKey: ["set-chat"],
		mutationFn: async (chatId: string) => {
			setChatId(chatId);
			await refetchMessages();
		},
	});

	return { folders, setChat };
};
