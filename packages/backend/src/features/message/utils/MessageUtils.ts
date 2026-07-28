import {
	type MessageState,
	zConfig,
	zData,
	zMetadata,
} from "@tiny-chat/shared/src/features/data/types/message.ts";
import type { Message } from "../../../../generated/prisma/client.ts";

export const MessageUtils = {
	/**
	 * Wrap a raw message row into a {@link MessageState}.
	 */
	toMessageState: (message: Message): MessageState => {
		return {
			...message,
			config: zConfig.parse(message.config),
			data: zData.parse(message.data),
			metadata: zMetadata.parse(message.metadata),
			state: {
				any: false,
				thinking: false,
				generating: false,
			},
		};
	},

	/**
	 * Wrap raw message rows into sorted {@link MessageState MessageStates}.
	 */
	toMessageStates: (messages: Message[]): MessageState[] => {
		if (messages.length <= 1) return messages.map(MessageUtils.toMessageState);

		const firstMessage = messages.find((m) => m.previousId === null);
		if (!firstMessage) return messages.map(MessageUtils.toMessageState);

		const sorted = [firstMessage];

		let currentId = firstMessage.id;
		while (sorted.length < messages.length) {
			const nextMessage = messages.find((m) => m.previousId === currentId);
			if (!nextMessage) break;
			sorted.push(nextMessage);
			currentId = nextMessage.id;
		}

		return sorted.map(MessageUtils.toMessageState);
	},
} as const;
