import type { ChatState } from "../types/chat.ts";

export const ChatUtils = {
	getTimestamp: (chat: ChatState) => {
		if (!chat) return -1;
		return Math.max(
			chat.createdAt.toZonedDateTime("UTC").epochMilliseconds,
			...chat.messages.map(
				(message) => message.createdAt.toZonedDateTime("UTC").epochMilliseconds,
			),
		);
	},
};
