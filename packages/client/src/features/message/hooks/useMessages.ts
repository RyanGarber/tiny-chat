import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useContext } from "react";
import { ClientContext } from "../../../client.ts";
import { useChatStore } from "../../chat/stores/useChatStore.ts";

const reversePages = <T>(data: { pages: T[]; pageParams: unknown[] }) => ({
	pages: [...data.pages].reverse(),
	pageParams: [...data.pageParams].reverse(),
});

export const useMessages = () => {
	const client = useContext(ClientContext);
	const chatId = useChatStore((s) => s.chatId);

	const messages = useInfiniteQuery({
		...client.query.message.getMessages.infiniteQueryOptions(
			{ chat: chatId, limit: 5 },
			{
				getNextPageParam: (lastPage) => lastPage.nextCursor,
			},
		),
		enabled: !!chatId,
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		placeholderData: keepPreviousData,
		select: reversePages,
	});

	return { messages };
};
