import type {
	CapabilityFactory,
	MemoriesCapability,
} from "#core/core/types/capability.ts";
import type { MemorySource } from "#core/features/data/types/memory.ts";
import type { MessageLike } from "#core/features/data/types/message.ts";
import type { zUser } from "#core/features/data/types/user.ts";
import { ChatSearchService } from "#server/features/chat/services/ChatSearchService.ts";
import { MemoryRetrievalService } from "#server/features/chat/services/MemoryRetrievalService.ts";
import { MemorySearchService } from "#server/features/chat/services/MemorySearchService.ts";
import { MemoryService } from "#server/features/chat/services/MemoryService.ts";

export const createMemoriesCapability: CapabilityFactory<
	{ user: zUser; message?: MessageLike | null },
	MemoriesCapability
> = async ({ user, message }) => ({
	retrieveMemories: async ({
		messages,
		tokens,
	}: {
		messages: MemorySource[];
		tokens: number;
	}) => {
		return await MemoryRetrievalService.retrieve({
			user,
			messages,
			tokens,
		});
	},

	searchMemories: async ({ searchText, searchEmbedding }) => {
		return await MemorySearchService.searchMemories({
			user,
			searchText,
			searchEmbedding,
		});
	},

	createMemory: async ({ fact, category, stability, evidence, confidence }) => {
		return await MemoryService.createMemory({
			user,
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
		return await MemoryService.updateMemory({
			user,
			message,
			id,
			fact,
			category,
			stability,
			evidence,
			confidence,
		});
	},

	deleteMemory: async ({ id }) => {
		return await MemoryService.deleteMemory({
			user,
			id,
		});
	},

	searchChats: async ({ searchText, searchEmbedding }) => {
		return (
			await ChatSearchService.searchChats({
				user,
				searchText,
				searchEmbedding,
			})
		).results;
	},
});
