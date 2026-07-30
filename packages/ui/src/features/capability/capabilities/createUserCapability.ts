import type {
	CapabilityFactory,
	UserCapability,
} from "@tiny-chat/core/src/features/capability/types/capability.ts";
import type { MessageLike } from "@tiny-chat/core/src/features/data/types/message.ts";
import { client } from "#ui/client.ts";

export const createUserCapability: CapabilityFactory<
	{ message: MessageLike },
	UserCapability
> = async ({ message }) => {
	return {
		getActions: async () => {
			return await client.api.action.getActions.query();
		},

		createAction: async ({ data, schedule, timezone }) => {
			return await client.api.action.createAction.mutate({
				message,
				data,
				schedule,
				timezone,
			});
		},

		updateAction: async ({ id, data, schedule, timezone }) => {
			return await client.api.action.updateAction.mutate({
				id,
				message,
				data,
				schedule,
				timezone,
			});
		},

		deleteAction: async ({ id }) => {
			return await client.api.action.deleteAction.mutate({ id });
		},

		createMemory: async ({
			fact,
			category,
			stability,
			evidence,
			confidence,
		}) => {
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
	};
};
