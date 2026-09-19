import { useQuery } from "@tanstack/react-query";
import type { zAgentChat } from "@tiny-chat/core/src/features/agent/types/agent.ts";
import { ChatUtils } from "@tiny-chat/core/src/features/data/utils/ChatUtils.ts";
import { useContext, useMemo } from "react";
import { ClientContext } from "../../../client.ts";
import { useSettings } from "../../settings/hooks/useSettings.ts";
import { useChatStore } from "../stores/useChatStore.ts";
import { useMessagingStore } from "../stores/useMessagingStore.ts";

export const useChat = () => {
	const client = useContext(ClientContext);

	const chatId = useChatStore((s) => s.chatId);
	const lastSeen = useChatStore((s) => s.lastSeen);
	const createIncognito = useChatStore((s) => s.createIncognito);
	const createTemporary = useChatStore((s) => s.createTemporary);
	const activeFolder = useMessagingStore((s) => s.activeFolder);

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
			?.pages.flatMap((page) => [
				...page.chats,
				...page.folders.flatMap((folder) => folder.chats),
			])
			.find((chat) => chat.id === chatId),
		enabled: !!chatId,
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	const { settings: folderSettings } = useSettings({
		folder: chatId ? null : activeFolder,
	});

	/**
	 * The chat the next message will belong to, whether or not it exists yet: the
	 * open chat, or a stand-in for the one that sending would create in the active
	 * folder. This is what an agent build is described by, so the folder's
	 * settings and the pending flags count before there is a row to read them off.
	 */
	const nextChat = useMemo((): zAgentChat => {
		if (chat.data) return chat.data;
		return {
			id: null,
			folder: activeFolder ? { settings: folderSettings.data ?? {} } : null,
			incognito: createIncognito,
			temporary: createTemporary,
		};
	}, [
		chat.data,
		activeFolder,
		folderSettings.data,
		createIncognito,
		createTemporary,
	]);

	return { chat, nextChat };
};
