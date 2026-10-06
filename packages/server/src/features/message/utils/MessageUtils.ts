import type { Model } from "#core/core/services/PostgresService.ts";
import type { PartialBy } from "#core/core/types/common.ts";
import type { MessageState } from "#core/features/data/types/message.ts";

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
