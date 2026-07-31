import { useConfigStore } from "../../../../../ui/src/features/config/stores/useConfigStore.ts";
import type { Client } from "../../../client.ts";
import { useChatStore } from "../stores/useChatStore.ts";

export const ChatService = {
	setChatId: (id: string | null) => {
		useChatStore.getState().setChatId(id);
		useChatStore.getState().requestScrollInstant();
		useChatStore.getState().setCreateIncognito(false);
		useChatStore.getState().setCreateTemporary(false);
		useConfigStore.getState().setOverrideConfig(null);
	},

	refetchChat: async (client: Client, chatId: string) => {
		useChatStore.getState().setLastSeen(chatId, Date.now());
		await client.queryClient.invalidateQueries({
			queryKey: client.query.chat.pathKey(),
		});
	},

	refetchChatList: async (client: Client) => {
		await client.queryClient.invalidateQueries({
			queryKey: client.query.chat.getChatList.pathKey(),
		});
	},

	refetchMessages: async (client: Client, chatId: string) => {
		if (chatId) useChatStore.getState().setLastSeen(chatId, Date.now());
		await client.queryClient.invalidateQueries({
			queryKey: client.query.message.pathKey(),
		});
	},
} as const;
