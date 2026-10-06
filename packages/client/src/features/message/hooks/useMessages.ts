import { useInfiniteQuery } from "@tanstack/react-query";
import { useContext } from "react";
import { useShallow } from "zustand/react/shallow";
import { ClientContext } from "#client/client.ts";
import { useChatStore } from "#client/features/chat/stores/useChatStore.ts";
import { MessageQueryService } from "#client/features/message/services/MessageQueryService.ts";

const reversePages = <T>(data: { pages: T[]; pageParams: unknown[] }) => ({
	pages: [...data.pages].reverse(),
	pageParams: [...data.pageParams].reverse(),
});

export const useMessages = () => {
	const client = useContext(ClientContext);
	const chatId = useChatStore((state) => state.chatId);

	const branches = useChatStore(useShallow((state) => state.branches));

	const messages = useInfiniteQuery({
		...MessageQueryService.options(client, chatId, branches),
		enabled: !!chatId,
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		select: reversePages,
	});

	return { messages };
};
