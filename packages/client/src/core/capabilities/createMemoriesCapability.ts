import type {
	CapabilityFactory,
	MemoriesCapability,
} from "@tiny-chat/core/src/core/types/capability.ts";
import type { MessageLike } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { Client } from "../../client.ts";

export const createMemoriesCapability: CapabilityFactory<
	{ client: Client; message?: MessageLike | null },
	MemoriesCapability
> = async ({ client, message }) => ({
	retrieveMemories: async ({ chat, tokens }) => {
		return await client.api.memory.retrieveMemories.query({ chat, tokens });
	},

	createMemory: async ({ fact, category, stability, evidence, confidence }) => {
		return await client.api.memory.createMemory.mutate({
			message,
			fact,
			category,
			stability,
			evidence,
			confidence,
		});
	},

	updateMemory: async ({
		id,
		fact,
		category,
		stability,
		evidence,
		confidence,
	}) => {
		return await client.api.memory.updateMemory.mutate({
			id,
			message,
			fact,
			category,
			stability,
			evidence,
			confidence,
		});
	},

	deleteMemory: async ({ id }) => {
		return await client.api.memory.deleteMemory.mutate({ id });
	},

	searchMemories: async ({ searchText, searchEmbedding }) => {
		return await client.api.memory.searchMemories.query({
			searchText,
			searchEmbedding,
		});
	},

	searchChats: async ({ searchText, searchEmbedding }) => {
		return (
			await client.api.chat.searchChats.query({
				searchText,
				searchEmbedding,
			})
		).results;
	},
});
