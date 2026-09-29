import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import type {
	ChatState,
	ProjectLike,
} from "@tiny-chat/core/features/data/types/chat.ts";
import { ChatUtils } from "@tiny-chat/core/features/data/utils/ChatUtils.ts";
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

	const projects = useInfiniteQuery({
		...client.query.chat.getChatList.infiniteQueryOptions(
			{ limit: 10 },
			{
				getNextPageParam: (lastPage, _pages) => lastPage.nextCursor,
				select: (data) => {
					return {
						pages: data.pages.map((page) => ({
							...page,
							chats: page.chats.map(markSeen),
							projects: page.projects.map((project) => ({
								...project,
								chats: project.chats.map(markSeen),
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
			projectId,
		}: {
			chat: ChatState;
			projectId: string | null;
		}) => client.api.chat.setChatProject.mutate({ chat, projectId }),
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

	const createProject = useMutation({
		mutationFn: () => client.api.chat.createProject.mutate(),
		onSuccess: () => ChatService.fetchChatList({ client }),
	});

	const updateProject = useMutation({
		mutationFn: ({ project, title }: { project: ProjectLike; title: string }) =>
			client.api.chat.updateProject.mutate({ project, title }),
		onSuccess: () => ChatService.fetchChatList({ client }),
	});

	const deleteProject = useMutation({
		mutationFn: ({
			project,
			deleteChats,
		}: {
			project: ProjectLike;
			deleteChats: boolean;
		}) => client.api.chat.deleteProject.mutate({ project, deleteChats }),
		onSuccess: () => {
			client.workingDirectory.refresh();
			return ChatService.fetchChatList({ client });
		},
	});

	return {
		projects,
		renameChat,
		moveChat,
		deleteChat,
		createProject,
		updateProject,
		deleteProject,
	};
};
