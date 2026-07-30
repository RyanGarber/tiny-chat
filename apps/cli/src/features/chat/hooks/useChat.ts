import { useQuery } from "@tanstack/react-query";
import { client } from "../../../client.ts";
import { useChatStore } from "../stores/useChatStore.ts";

export const useChat = () => {
	const chatId = useChatStore((state) => state.chatId);

	const chat = useQuery({
		queryKey: ["chat", chatId],
		queryFn: async () => {
			if (!chatId) return null;
			return await client.api.chat.getChat.query(chatId);
		},
		initialData: client.queryClient
			.getQueryData(
				client.query.chat.getChatList.infiniteQueryKey({ limit: 10 }),
			)
			?.pages.flatMap((page) => page.folders)
			.flatMap((folder) => folder.chats)
			.find((chat) => chat.id === chatId),
		enabled: !!chatId,
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	return { chat };
};
