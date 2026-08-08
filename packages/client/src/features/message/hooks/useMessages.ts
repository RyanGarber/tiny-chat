import { useInfiniteQuery } from "@tanstack/react-query";
import { useContext } from "react";
import { ClientContext } from "../../../client.ts";
import { useChat } from "../../chat/hooks/useChat.ts";

export const useMessages = () => {
	const client = useContext(ClientContext);

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
