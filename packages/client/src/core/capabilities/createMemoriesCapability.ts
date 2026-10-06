import type { Client } from "#client/client.ts";
import type {
	CapabilityFactory,
	MemoriesCapability,
} from "#core/core/types/capability.ts";
import type { MessageLike } from "#core/features/data/types/message.ts";

export const createMemoriesCapability: CapabilityFactory<
	{ client: Client; message?: MessageLike | null },
	MemoriesCapability
> = async ({ client, message }) => ({
	retrieveMemories: async ({ messages, tokens }) => {
		return await client.api.memory.retrieveMemories.query({ messages, tokens });
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
