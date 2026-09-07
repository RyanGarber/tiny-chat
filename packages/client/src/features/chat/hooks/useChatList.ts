import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import type {
	ChatState,
	FolderLike,
} from "@tiny-chat/core/src/features/data/types/chat.ts";
import { ChatUtils } from "@tiny-chat/core/src/features/data/utils/ChatUtils.ts";
import { useContext } from "react";
import { ClientContext } from "../../../client.ts";
import { ChatService } from "../services/ChatService.ts";
import { useChatStore } from "../stores/useChatStore.ts";

export const useChatList = () => {
	const client = useContext(ClientContext);

	const lastSeen = useChatStore((s) => s.lastSeen);
	const chatId = useChatStore((s) => s.chatId);

	const markSeen = (chat: ChatState): ChatState => {
		if (!(chat.id in lastSeen))
			useChatStore
				.getState()
				.setLastSeen(chat.id, ChatUtils.getTimestamp(chat));
		return {
			...chat,
			unseen: ChatUtils.getTimestamp(chat) > lastSeen[chat.id],
		};
	};

	const folders = useInfiniteQuery({
		...client.query.chat.getChatList.infiniteQueryOptions(
			{ limit: 10 },
			{
				getNextPageParam: (lastPage, _pages) => lastPage.nextCursor,
				select: (data) => {
					return {
						pages: data.pages.map((page) => ({
							...page,
							chats: page.chats.map(markSeen),
							folders: page.folders.map((folder) => ({
								...folder,
								chats: folder.chats.map(markSeen),
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

	const renameChat = useMutation({
		mutationFn: async ({ chat, title }: { chat: ChatState; title: string }) => {
			await client.api.chat.setChatTitle.mutate({ chat, title });
		},
		onSuccess: () => ChatService.fetchChatList({ client }),
	});

	const moveChat = useMutation({
		mutationFn: ({
			chat,
			folderId,
		}: {
			chat: ChatState;
			folderId: string | null;
		}) => client.api.chat.setChatFolder.mutate({ chat, folderId }),
		onSuccess: () => {
			client.workingDirectory.refresh();
			return ChatService.fetchChatList({ client });
		},
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

	const createFolder = useMutation({
		mutationFn: () => client.api.chat.createFolder.mutate(),
		onSuccess: () => ChatService.fetchChatList({ client }),
	});

	const renameFolder = useMutation({
		mutationFn: ({
			folder,
			title,
			cwd,
		}: {
			folder: FolderLike;
			title: string;
			cwd?: string | null;
		}) => client.api.chat.setFolderTitle.mutate({ folder, title, cwd }),
		onSuccess: () => {
			client.workingDirectory.refresh();
			return ChatService.fetchChatList({ client });
		},
	});

	const deleteFolder = useMutation({
		mutationFn: ({
			folder,
			deleteChats,
		}: {
			folder: FolderLike;
			deleteChats: boolean;
		}) => client.api.chat.deleteFolder.mutate({ folder, deleteChats }),
		onSuccess: () => {
			client.workingDirectory.refresh();
			return ChatService.fetchChatList({ client });
		},
	});

	return {
		folders,
		renameChat,
		moveChat,
		deleteChat,
		createFolder,
		renameFolder,
		deleteFolder,
	};
};
