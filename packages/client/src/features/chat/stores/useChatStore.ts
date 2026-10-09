import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type {
	ActiveChat,
	ChatPlacement,
	NewChatOptions,
	ProjectRef,
} from "#client/features/chat/types/activeChat.ts";
import { ActiveChatUtils } from "#client/features/chat/utils/ActiveChatUtils.ts";

interface ChatStore {
	active: ActiveChat;
	/**
	 * Counts arrivals at a chat, the one already open included, so the view can
	 * settle on its end each time.
	 */
	visits: number;

	open: (chatId: string) => void;
	start: (project: ProjectRef | null) => void;
	load: (chat: ChatPlacement) => void;
	setOptions: (options: Partial<NewChatOptions>) => void;
	selectBranch: (parentId: string | null, messageId: string) => void;
	focusMessage: (messageId: string, branches: Record<string, string>) => void;
	clearFocusedMessage: () => void;
}

export const useChatStore = create(
	subscribeWithSelector<ChatStore>((set) => ({
		active: ActiveChatUtils.start(null),
		visits: 0,

		open: (chatId) =>
			set((s) => ({
				active: ActiveChatUtils.open(s.active, chatId),
				visits: s.visits + 1,
			})),
		start: (project) =>
			set((s) => ({
				active: ActiveChatUtils.start(project),
				visits: s.visits + 1,
			})),
		load: (chat) =>
			set((s) => ({ active: ActiveChatUtils.load(s.active, chat) })),
		setOptions: (options) =>
			set((s) => ({ active: ActiveChatUtils.setOptions(s.active, options) })),
		selectBranch: (parentId, messageId) =>
			set((s) => ({
				active: ActiveChatUtils.selectBranch(s.active, parentId, messageId),
			})),
		focusMessage: (messageId, branches) =>
			set((s) => ({
				active: ActiveChatUtils.focus(s.active, messageId, branches),
			})),
		clearFocusedMessage: () =>
			set((s) => ({ active: ActiveChatUtils.clearFocus(s.active) })),
	})),
);
