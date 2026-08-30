import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import {
	type MessageState,
	zConfig,
	zData,
	zMetadata,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import type { Message } from "../../../../generated/prisma/client.ts";

type Message8 = Awaited<
	ReturnType<typeof globalThis.db.orm.public.Message.all>
>[number];
type MessageWithMetadataOptional =
	| Omit<Message, "metadata">
	| Omit<Message8, "metadata">;

export const MessageUtils = {
	/**
	 * Wrap a raw message row into a {@link MessageState}.
	 */
	toMessageState: (message: MessageWithMetadataOptional): MessageState => {
		return {
			...message,
			createdAt:
				message.createdAt instanceof Date
					? message.createdAt
					: CommonUtils.toDate(message.createdAt),
			config: zConfig.parse(message.config),
			data: zData.parse(message.data),
			metadata: zMetadata.parse(
				("metadata" in message ? message.metadata : undefined) ?? [
					[{ _omit: true }],
				],
			),
		};
	},

	/**
	 * Parse raw message rows without dropping sibling branches into {@link MessageState MessageStates}.
	 */
	toMessageStates: (
		messages: MessageWithMetadataOptional[],
	): MessageState[] => {
		return messages.map(MessageUtils.toMessageState);
	},
} as const;
