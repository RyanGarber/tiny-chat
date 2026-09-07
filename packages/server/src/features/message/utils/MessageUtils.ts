import type { Model } from "@tiny-chat/core/src/core/services/PostgresService.ts";
import type { PartialBy } from "@tiny-chat/core/src/core/types/common.ts";
import type { MessageState } from "@tiny-chat/core/src/features/data/types/message.ts";

export const MessageUtils = {
	/**
	 * Wrap a raw message row into a {@link MessageState}.
	 */
	toMessageState: ({
		embedding,
		...message
	}: PartialBy<Model["Message"], "metadata" | "embedding">): MessageState => {
		return {
			...message,
			metadata: ("metadata" in message ? message.metadata : undefined) ?? [
				[{ _omit: true }],
			],
		};
	},

	/**
	 * Parse raw message rows without dropping sibling branches into {@link MessageState MessageStates}.
	 */
	toMessageStates: (
		messages: PartialBy<Model["Message"], "metadata" | "embedding">[],
	): MessageState[] => {
		return messages.map(MessageUtils.toMessageState);
	},
} as const;
