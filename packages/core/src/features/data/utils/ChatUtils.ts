import type { ChatState } from "../types/chat.ts";

export const ChatUtils = {
	getTimestamp: (chat: ChatState) => {
		if (!chat) return -1;
		return Math.max(
			chat.createdAt.getTime(),
			...(chat.messages as { createdAt: Date }[]).map((m) =>
				m.createdAt.getTime(),
			),
		);
	},
};
