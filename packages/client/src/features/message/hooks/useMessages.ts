import { useInfiniteQuery } from "@tanstack/react-query";
import { useContext } from "react";
import { useShallow } from "zustand/react/shallow";
import { ClientContext } from "../../../client.ts";
import { useChatStore } from "../../chat/stores/useChatStore.ts";

const reversePages = <T>(data: { pages: T[]; pageParams: unknown[] }) => ({
	pages: [...data.pages].reverse(),
	pageParams: [...data.pageParams].reverse(),
});

export const useMessages = () => {
	const client = useContext(ClientContext);
	const chatId = useChatStore((state) => state.chatId);

	const branches = useChatStore(useShallow((state) => state.branches));

	const messages = useInfiniteQuery({
		...client.query.message.getMessages.infiniteQueryOptions(
			{ chat: chatId, limit: 5, branches },
			{
				getNextPageParam: (lastPage) => lastPage.nextCursor,
			},
		),
		enabled: !!chatId,
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		select: reversePages,
	});

	return { messages };
};
