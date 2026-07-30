import { useQuery } from "@tanstack/react-query";
import {
	tRPCQuery,
	tRPCQueryClient,
	tRPCService,
} from "../../../core/services/tRPCService.ts";
import { useChatStore } from "../stores/useChatStore.ts";

export const useChat = () => {
	const chatId = useChatStore((state) => state.chatId);
	const setChatId = useChatStore((state) => state.setChatId);

	const chat = useQuery({
		queryKey: ["chat", chatId],
		queryFn: async () => {
			if (!chatId) return null;
			return await tRPCService.chat.getChat.query(chatId);
		},
		initialData: tRPCQueryClient
			.getQueryData(tRPCQuery.chat.getChatList.infiniteQueryKey({ limit: 10 }))
			?.pages.flatMap((page) => page.folders)
			.flatMap((folder) => folder.chats)
			.find((chat) => chat.id === chatId),
		enabled: !!chatId,
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	const setChat = (id: string) => {
		setChatId(id);
	};

	return { chat, setChat };
};
