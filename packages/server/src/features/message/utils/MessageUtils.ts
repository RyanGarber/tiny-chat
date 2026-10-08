import type { Model } from "#core/core/services/PostgresService.ts";
import type { MessageState } from "#core/features/data/types/message.ts";

export const MessageUtils = {
	/**
	 * The columns a {@link MessageState} is read from. Every read and write that
	 * hands a message back selects these, so neither the embedding nor the
	 * metadata of a generation leaves the database unless asked for by name.
	 */
	columns: [
		"id",
		"userId",
		"chatId",
		"previousId",
		"author",
		"config",
		"data",
		"createdAt",
		"updatedAt",
	] as const,

	/** Wrap a message row into a {@link MessageState}, dropping anything extra. */
	toMessageState: ({
		id,
		userId,
		chatId,
		previousId,
		author,
		config,
		data,
		createdAt,
		updatedAt,
	}: Omit<Model["Message"], "embedding" | "metadata">): MessageState => ({
		id,
		userId,
		chatId,
		previousId,
		author,
		config,
		data,
		createdAt,
		updatedAt,
	}),

	toMessageStates: (
		messages: Omit<Model["Message"], "embedding" | "metadata">[],
	): MessageState[] => messages.map(MessageUtils.toMessageState),
} as const;
