import type { Client } from "#client/client.ts";
import { useConfigStore } from "#client/features/agent/stores/useConfigStore.ts";
import { useChatStore } from "#client/features/chat/stores/useChatStore.ts";
import { useMessagingStore } from "#client/features/chat/stores/useMessagingStore.ts";
import { MessageQueryService } from "#client/features/message/services/MessageQueryService.ts";

export const ChatService = {
	newChat: (folder: { id: string; title: string | null } | null = null) => {
		useMessagingStore.getState().setProject(folder);
		ChatService.setChat({ id: null });
	},
	/**
	 * Leaves the open chat for a new one in the same project: the chat's own
	 * project when one is open, otherwise whichever is already active.
	 */
	clearChat: (
		chat?: {
			projectId: string | null;
			project: { title: string | null } | null;
		} | null,
	) => {
		if (chat) {
			ChatService.newChat(
				chat.projectId
					? { id: chat.projectId, title: chat.project?.title ?? null }
					: null,
			);
		} else {
			ChatService.setChat({ id: null });
		}
	},
	/**
	 * Leaves the current chat (if any) for a new one in the next project. The
	 * cycle runs none, first, ..., last, none.
	 */
	cycleProject: (projects: { id: string; title: string | null }[]) => {
		if (!projects.length) return;
		const current = useMessagingStore.getState().project;
		const index = projects.findIndex((other) => other.id === current?.id);
		ChatService.newChat(
			index + 1 < projects.length ? projects[index + 1] : null,
		);
	},
	setChat: ({ id }: { id: string | null }) => {
		// Leaving for a new chat keeps the current config; entering an existing
		// one adopts that chat's.
		if (id !== useChatStore.getState().chatId) {
			useConfigStore.getState().setSyncChatId(id);
		}
		useChatStore.getState().setChatId(id);
		useChatStore.getState().requestScrollInstant();
		useChatStore.getState().setCreateIncognito(false);
		useChatStore.getState().setCreateTemporary(false);
	},

	/**
	 * Opens the chat a message is in, on the branch that leads to it, and asks
	 * for it to be scrolled to. Selections below it are kept when it is in the chat already open.
	 */
	openMessage: async ({ client, id }: { client: Client; id: string }) => {
		const located = await client.api.message.locateMessage.query({
			message: id,
		});
		const state = useChatStore.getState();
		const branches =
			state.chatId === located.chatId
				? { ...state.branches, ...located.branches }
				: located.branches;
		// Loaded before switching, so the chat opens on it instead of filling in.
		await client.queryClient.prefetchQuery(
			MessageQueryService.options(client, located.chatId, branches),
		);
		if (state.chatId !== located.chatId)
			ChatService.setChat({ id: located.chatId });
		useChatStore.getState().focusMessage(id, branches);
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
		await MessageQueryService.invalidate(client, chatId);
	},
} as const;
