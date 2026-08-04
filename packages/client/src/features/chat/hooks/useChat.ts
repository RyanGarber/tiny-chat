import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChatState } from "@tiny-chat/core/src/features/data/types/chat.ts";
import type { MessageState } from "@tiny-chat/core/src/features/data/types/message.ts";
import { ChatUtils } from "@tiny-chat/core/src/features/data/utils/ChatUtils.ts";
import { useContext } from "react";
import { ClientProvider } from "../../../client.ts";
import { ChatService } from "../services/ChatService.ts";
import { useChatStore } from "../stores/useChatStore.ts";

export const useChat = () => {
	const client = useContext(ClientProvider);

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
			?.pages.flatMap((page) => page.folders)
			.flatMap((folder) => folder.chats)
			.find((chat) => chat.id === chatId),
		enabled: !!chatId,
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	const cloneChat = useMutation({
		mutationFn: async ({
			chat,
			upToMessage,
		}: {
			chat: ChatState;
			upToMessage: MessageState;
		}) => {
			return client.api.chat.cloneChat.mutate({
				chat,
				upToMessage,
				title: chat.title ? `Fork of ${chat.title}` : "Forked Chat",
			});
		},
		onSuccess: async (clone, input) => {
			await ChatService.fetchChat({ client, id: clone.id });
			if (input.chat.id === chatId) ChatService.setChat(clone);
		},
	});

	return { chat, cloneChat };
};
