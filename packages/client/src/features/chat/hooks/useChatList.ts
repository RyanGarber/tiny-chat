import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import type { ChatState } from "@tiny-chat/core/src/features/data/types/chat.ts";
import { ChatUtils } from "@tiny-chat/core/src/features/data/utils/ChatUtils.ts";
import { useContext } from "react";
import { ClientProvider } from "../../../client.ts";
import { ChatService } from "../services/ChatService.ts";
import { useChatStore } from "../stores/useChatStore.ts";

export const useChatList = () => {
	const client = useContext(ClientProvider);

	const lastSeen = useChatStore((s) => s.lastSeen);
	const chatId = useChatStore((s) => s.chatId);

	const folders = useInfiniteQuery({
		...client.query.chat.getChatList.infiniteQueryOptions(
			{ limit: 10 },
			{
				getNextPageParam: (lastPage, _pages) => lastPage.nextCursor,
				select: (data) => {
					return {
						pages: data.pages.map((page) => ({
							...page,
							folders: page.folders.map((folder) => ({
								...folder,
								chats: folder.chats.map((chat): ChatState => {
									if (!(chat.id in lastSeen))
										useChatStore
											.getState()
											.setLastSeen(chat.id, ChatUtils.getTimestamp(chat));
									return {
										...chat,
										unseen: ChatUtils.getTimestamp(chat) > lastSeen[chat.id],
									};
								}),
							})),
						})),
						pageParams: data.pageParams,
					};
				},
				staleTime: 600000,
				refetchOnWindowFocus: false,
				refetchOnReconnect: false,
			},
		),
	});

	const deleteChat = useMutation({
		mutationFn: async ({ chat }: { chat: ChatState }) => {
			return client.api.chat.deleteChat.mutate(chat);
		},
		onSuccess: async (_, input) => {
			await ChatService.fetchChatList({ client });
			if (chatId === input.chat.id) ChatService.setChat({ id: null });
		},
	});

	const renameChat = useMutation({
		mutationFn: async ({ chat, title }: { chat: ChatState; title: string }) => {
			await client.api.chat.setChatTitle.mutate({ chat, title });
		},
		onSuccess: () => ChatService.fetchChatList({ client }),
	});

	return { folders, deleteChat, renameChat };
};
