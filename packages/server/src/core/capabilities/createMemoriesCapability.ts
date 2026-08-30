import type {
	CapabilityFactory,
	MemoriesCapability,
} from "@tiny-chat/core/src/core/types/capability.ts";
import type { ChatLike } from "@tiny-chat/core/src/features/data/types/chat.ts";
import type { MessageLike } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { ChatSearchService } from "../../features/chat/services/ChatSearchService.ts";
import { MemoryRetrievalService } from "../../features/chat/services/MemoryRetrievalService.ts";
import { MemorySearchService } from "../../features/chat/services/MemorySearchService.ts";
import { MemoryService } from "../../features/chat/services/MemoryService.ts";

export const createMemoriesCapability: CapabilityFactory<
	{ user: zUser; message?: MessageLike | null },
	MemoriesCapability
> = async ({ user, message }) => ({
	retrieveMemories: async ({
		chat,
	}: {
		chat?: ChatLike | MessageLike | null;
	} = {}) => {
		return await MemoryRetrievalService.retrieve({
			user,
			chat,
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
