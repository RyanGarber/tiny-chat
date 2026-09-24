import type { ChatState } from "@tiny-chat/core/features/data/types/chat.ts";

export const ChatUtils = {
	toChatState: (chat: Omit<ChatState, "unseen">): ChatState => {
		return {
			...chat,
			unseen: false,
		};
	},
} as const;
