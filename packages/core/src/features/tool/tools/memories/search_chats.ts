import { z } from "zod";
import type { UserCapability } from "../../../../core/types/capability.ts";
import { SnippetService } from "../../../data/services/SnippetService.ts";
import { Author } from "../../../data/types/message.ts";
import { DataUtils } from "../../../data/utils/DataUtils.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

export const search_chats = {
	name: "search_chats",
	description: "Search all known chats for a given query.",
	input: z.object({
		query: z.string(),
	}),
	output: z.object({
		id: z.cuid2(),
		chat_id: z.cuid2(),
		chat_title: z.string().nullable(),
		author: z.enum(Author),
		snippet: z.string(),
		created_at: z.date(),
	}),
} as const satisfies ToolDefinition;

export const createSearchChatsTool: ToolFactory<
	Tool<typeof search_chats, { user: UserCapability }>
> = (options) => ({
	...search_chats,
	...options,
	execute: async ({ input }) => {
		const messages = await options.capabilities.user.searchChats({
			searchText: input.query,
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
				created_at: message.createdAt,
			},
		}));
	},
});
