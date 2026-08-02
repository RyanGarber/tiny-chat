import type { JsonValue } from "@prisma/client/runtime/client";
import {
	type MessageState,
	zConfig,
	zData,
	zMetadata,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import type { Message } from "../../../../generated/prisma/client.ts";

type MessageWithMetadataOptional = Message & { metadata?: JsonValue | null };

export const MessageUtils = {
	/**
	 * Wrap a raw message row into a {@link MessageState}.
	 */
	toMessageState: (message: MessageWithMetadataOptional): MessageState => {
		return {
			...message,
			config: zConfig.parse(message.config),
			data: zData.parse(message.data),
			metadata: zMetadata.parse(message.metadata ?? [[{ _omit: true }]]),
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
	toMessageStates: (
		messages: MessageWithMetadataOptional[],
	): MessageState[] => {
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
