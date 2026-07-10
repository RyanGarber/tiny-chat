import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import {
	type ChatState,
	getChatTimestamp,
} from "#frontend/features/chat/hooks/useChat.ts";
import { query, queryClient, trpc } from "#frontend/utils/api.ts";
import { ChatService } from "../services/ChatService";
import { useChatStore } from "../stores/useChatStore";

export const refetchChatList = () => {
	return queryClient.invalidateQueries({
		queryKey: query.chat.pathKey(),
	});
};

export const useChatList = () => {
	const lastSeen = useChatStore((s) => s.lastSeen);
	const chatId = useChatStore((s) => s.chatId);

	const folders = useInfiniteQuery({
		...query.chat.list.infiniteQueryOptions(
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
			return trpc.chat.delete.mutate({ id: chat.id });
		},
		onSuccess: async (_, input) => {
			await refetchChatList();
			if (chatId === input.chat.id) ChatService.setChatId(null);
		},
	});

	const renameChat = useMutation({
		mutationFn: async ({ chat, title }: { chat: ChatState; title: string }) => {
			await trpc.chat.edit.mutate({ id: chat.id, title });
		},
		onSuccess: () => refetchChatList(),
	});

	return { folders, deleteChat, renameChat };
};
