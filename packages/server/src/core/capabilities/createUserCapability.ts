import type {
	CapabilityFactory,
	UserCapability,
} from "@tiny-chat/core/src/core/types/capability.ts";
import type { MessageLike } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { ActionService } from "../../features/chat/services/ActionService.ts";
import { ChatSearchService } from "../../features/chat/services/ChatSearchService.ts";
import { MemorySearchService } from "../../features/chat/services/MemorySearchService.ts";
import { MemoryService } from "../../features/chat/services/MemoryService.ts";

export const createUserCapability: CapabilityFactory<
	{ user: zUser; message: MessageLike },
	UserCapability
> = async ({ user, message }) => {
	return {
		getActions: async () => {
			return ActionService.getActions({ user });
		},

		updateAction: async ({ id, data, schedule, timezone }) => {
			return ActionService.updateAction({
				user,
				message,
				id,
				data,
				schedule,
				timezone,
			});
		},

		deleteAction: async ({ id }) => {
			return ActionService.deleteAction({ user, id });
		},

		createAction: async ({ data, schedule, timezone }) => {
			return ActionService.createAction({
				user,
				message,
				data,
				schedule,
				timezone,
			});
		},

		searchMemories: async ({ searchText, searchEmbedding }) => {
			return await MemorySearchService.searchMemories({
				user,
				searchText,
				searchEmbedding,
			});
		},

		createMemory: async ({
			fact,
			category,
			stability,
			evidence,
			confidence,
		}) => {
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
	};
};
