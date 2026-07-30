import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import type { ChatState } from "@tiny-chat/core/src/features/data/types/chat.ts";
import { client } from "#ui/client.ts";
import { getChatTimestamp } from "#ui/features/chat/hooks/useChat.ts";
import { ChatService } from "../services/ChatService";
import { useChatStore } from "../stores/useChatStore";

export const refetchChatList = () => {
	return client.queryClient.invalidateQueries({
		queryKey: client.query.chat.getChatList.pathKey(),
	});
};

export const useChatList = () => {
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
											.setLastSeen(chat.id, getChatTimestamp(chat));
									return {
										...chat,
										unseen: getChatTimestamp(chat) > lastSeen[chat.id],
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
			await refetchChatList();
			if (chatId === input.chat.id) ChatService.setChatId(null);
		},
	});

	const renameChat = useMutation({
		mutationFn: async ({ chat, title }: { chat: ChatState; title: string }) => {
			await client.api.chat.setChatTitle.mutate({ chat, title });
		},
		onSuccess: () => refetchChatList(),
	});

	return { folders, deleteChat, renameChat };
};
