import type { Client } from "../../../client.ts";
import { useConfigStore } from "../../agent/stores/useConfigStore.ts";
import { useChatStore } from "../stores/useChatStore.ts";

export const ChatService = {
	setChat: ({ id }: { id: string | null }) => {
		useChatStore.getState().setChatId(id);
		useChatStore.getState().requestScrollInstant();
		useChatStore.getState().setCreateIncognito(false);
		useChatStore.getState().setCreateTemporary(false);
		useConfigStore.getState().setOverrideConfig(null);
	},

	fetchChat: async ({ client, id }: { client: Client; id: string }) => {
		useChatStore.getState().setLastSeen(id, Date.now());
		await client.queryClient.invalidateQueries({
			queryKey: client.query.chat.getChat.pathKey(),
		});
	},

	fetchChatList: async ({ client }: { client: Client }) => {
		await client.queryClient.invalidateQueries({
			queryKey: client.query.chat.getChatList.pathKey(),
		});
	},

	fetchMessages: async ({
		client,
		chatId,
	}: {
		client: Client;
		chatId: string;
	}) => {
		if (chatId) useChatStore.getState().setLastSeen(chatId, Date.now());
		await client.queryClient.invalidateQueries({
			queryKey: client.query.message.pathKey(),
		});
	},
} as const;
