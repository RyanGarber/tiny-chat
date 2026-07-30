import type {
	CapabilityFactory,
	UserCapability,
} from "@tiny-chat/shared/src/features/capability/types/capability.ts";
import type { MessageLike } from "@tiny-chat/shared/src/features/data/types/message.ts";
import { trpc } from "#frontend/utils/api.ts";

export const createUserCapability: CapabilityFactory<
	{ message: MessageLike },
	UserCapability
> = async ({ message }) => {
	return {
		getActions: async () => {
			return await trpc.action.getActions.query();
		},

		createAction: async ({ data, schedule, timezone }) => {
			return await trpc.action.createAction.mutate({
				message,
				data,
				schedule,
				timezone,
			});
		},

		updateAction: async ({ id, data, schedule, timezone }) => {
			return await trpc.action.updateAction.mutate({
				id,
				message,
				data,
				schedule,
				timezone,
			});
		},

		deleteAction: async ({ id }) => {
			return await trpc.action.deleteAction.mutate({ id });
		},

		createMemory: async ({
			fact,
			category,
			stability,
			evidence,
			confidence,
		}) => {
			return await trpc.memory.createMemory.mutate({
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
			return await trpc.memory.updateMemory.mutate({
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
			return await trpc.memory.deleteMemory.mutate({ id });
		},

		searchMemories: async ({ searchText, searchEmbedding }) => {
			return await trpc.memory.searchMemories.query({
				searchText,
				searchEmbedding,
			});
		},

		searchChats: async ({ searchText, searchEmbedding }) => {
			return (
				await trpc.chat.searchChats.query({
					searchText,
					searchEmbedding,
				})
			).results;
		},
	};
};
