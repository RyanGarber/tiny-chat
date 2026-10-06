import { useQuery } from "@tanstack/react-query";
import { useContext, useMemo } from "react";
import { ClientContext } from "#client/client.ts";
import { useChatStore } from "#client/features/chat/stores/useChatStore.ts";
import { useMemories } from "#client/features/user/hooks/useMemories.ts";
import { CommonUtils } from "#core/core/utils/CommonUtils.ts";

/** Memories the chat learned or was reminded of, newest first. */
export const useChatMemories = () => {
	const client = useContext(ClientContext);
	const chatId = useChatStore((state) => state.chatId);
	const { memories } = useMemories();

	const ids = useQuery({
		...client.query.memory.getChatMemoryIds.queryOptions({
			chat: chatId ?? "",
		}),
		enabled: !!chatId,
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	const chatMemories = useMemo(() => {
		const included = new Set(ids.data);
		return (memories.data ?? [])
			.filter((memory) => included.has(memory.id))
			.sort(
				(a, b) =>
					CommonUtils.toDate(b.createdAt).getTime() -
					CommonUtils.toDate(a.createdAt).getTime(),
			);
	}, [ids.data, memories.data]);

	return {
		chatMemories,
		isFetching: ids.isFetching || memories.isFetching,
	};
};
