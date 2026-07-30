import type { ChatState } from "@tiny-chat/core/src/features/data/types/chat.ts";

export const ChatUtils = {
	toChatState: (chat: Omit<ChatState, "unseen">): ChatState => {
		return {
			...chat,
			unseen: false,
		};
	},
} as const;
