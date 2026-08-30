import { useQuery } from "@tanstack/react-query";
import { ChatUtils } from "@tiny-chat/core/src/features/data/utils/ChatUtils.ts";
import { useContext } from "react";
import { ClientContext } from "../../../client.ts";
import { useChatStore } from "../stores/useChatStore.ts";

export const useChat = () => {
	const client = useContext(ClientContext);

	const chatId = useChatStore((s) => s.chatId);
	const lastSeen = useChatStore((s) => s.lastSeen);

	const chat = useQuery({
		queryKey: client.query.chat.getChat.queryKey({ id: chatId || undefined }),
		queryFn: async () => {
			if (!chatId) return null;
			const data = await client.api.chat.getChat.query(chatId);
			if (!(data.id in lastSeen)) {
				useChatStore
					.getState()
					.setLastSeen(data.id, ChatUtils.getTimestamp(data));
			}
			return {
				...data,
				unseen: ChatUtils.getTimestamp(data) > lastSeen[data.id],
			};
		},
		initialData: client.queryClient
			.getQueryData(
				client.query.chat.getChatList.infiniteQueryKey({ limit: 10 }),
			)
			?.pages.flatMap((page) => [
				...page.chats,
				...page.folders.flatMap((folder) => folder.chats),
			])
			.find((chat) => chat.id === chatId),
		enabled: !!chatId,
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	return { chat };
};
