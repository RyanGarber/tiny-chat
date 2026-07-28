import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChatState } from "@tiny-chat/shared/src/features/data/types/chat.ts";
import type { MessageState } from "@tiny-chat/shared/src/features/data/types/message.ts";
import { ChatService } from "#frontend/features/chat/services/ChatService.ts";
import { useChatStore } from "#frontend/features/chat/stores/useChatStore.ts";
import { query, queryClient, trpc } from "#frontend/utils/api.ts";

export function getChatTimestamp(chat: ChatState) {
	if (!chat) return -1;
	return Math.max(
		chat.createdAt.getTime(),
		...(chat.messages as { createdAt: Date }[]).map((m) =>
			m.createdAt.getTime(),
		),
	);
}

export async function refetchChat(chatId: string) {
	await queryClient.invalidateQueries({
		queryKey: query.chat.pathKey(),
	});
	useChatStore.getState().setLastSeen(chatId, Date.now());
}

export const useChat = () => {
	const chatId = useChatStore((s) => s.chatId);
	const lastSeen = useChatStore((s) => s.lastSeen);

	const chat = useQuery({
		queryKey: ["chat", chatId],
		queryFn: async () => {
			if (!chatId) return null;
			const data = await trpc.chat.getChat.query(chatId);
			if (!(data.id in lastSeen)) {
				useChatStore.getState().setLastSeen(data.id, getChatTimestamp(data));
			}
			return {
				...data,
				unseen: getChatTimestamp(data) > lastSeen[data.id],
			};
		},
		initialData: queryClient
			.getQueryData(query.chat.getChatList.infiniteQueryKey({ limit: 10 }))
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
			return trpc.chat.cloneChat.mutate({
				chat,
				upToMessage,
				title: chat.title ? `Fork of ${chat.title}` : "Forked Chat",
			});
		},
		onSuccess: async (clone, input) => {
			await refetchChat(clone.id);
			if (input.chat.id === chatId) ChatService.setChatId(clone.id);
		},
	});

	return { chat, cloneChat };
};
