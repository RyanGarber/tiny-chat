import { z } from "zod";
import { Enum } from "../../../../core/services/PostgresService.ts";
import type {
	EmbeddingCapability,
	MemoriesCapability,
} from "../../../../core/types/capability.ts";
import { zId } from "../../../../core/types/common.ts";
import { CommonUtils } from "../../../../core/utils/CommonUtils.ts";
import { SnippetService } from "../../../data/services/SnippetService.ts";
import { DataUtils } from "../../../data/utils/DataUtils.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

export const search_chats = {
	name: "search_chats",
	description: "Search all known chats for a given query.",
	input: z.object({
		query: z.string(),
	}),
	output: z.object({
		id: zId,
		chat_id: zId,
		chat_title: z.string().nullable(),
		author: z.enum(Enum.Author.values),
		snippet: z.string(),
		created_at: z.date(),
	}),
} as const satisfies ToolDefinition;

export const createSearchChatsTool: ToolFactory<
	Tool<
		typeof search_chats,
		{ embedding?: EmbeddingCapability; memories: MemoriesCapability }
	>
> = (options) => ({
	...search_chats,
	...options,
	execute: async ({ input }) => {
		let embedding: number[] | undefined;
		if (options.capabilities.embedding) {
			try {
				embedding = await options.capabilities.embedding?.runEmbedding({
					text: input.query,
				});
			} catch (error) {
				console.error("error running embedding:", error);
			}
		}
		const messages = await options.capabilities.memories.searchChats({
			searchText: input.query,
			searchEmbedding: embedding,
		});
		return messages.map((message) => ({
			type: "json",
			value: {
				id: message.id,
				chat_id: message.chatId,
				chat_title: message.chatTitle,
				author: message.author,
				snippet: SnippetService.getSnippet({
					text: DataUtils.getTextCleaned(message),
					query: input.query,
					maxChars: 250,
				}),
				created_at: CommonUtils.toDate(message.createdAt),
			},
		}));
	},
});
