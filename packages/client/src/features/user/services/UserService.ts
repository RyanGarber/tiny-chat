import type { Client } from "#client/client.ts";
import { nextEmbeddingBatchQueryKey } from "#client/features/user/hooks/useEmbedding.ts";

export const UserService = {
	fetchActions: async ({ client }: { client: Client }) => {
		await client.queryClient.invalidateQueries({
			queryKey: client.query.action.getActions.pathKey(),
		});
	},

	fetchMemories: async ({ client }: { client: Client }) => {
		await client.queryClient.invalidateQueries({
			queryKey: client.query.memory.getMemories.pathKey(),
		});
		await client.queryClient.invalidateQueries({
			queryKey: client.query.memory.getChatMemoryIds.pathKey(),
		});
	},

	fetchNextEmbeddingBatch: async ({ client }: { client: Client }) => {
		await client.queryClient.invalidateQueries({
			queryKey: nextEmbeddingBatchQueryKey,
		});
	},
} as const;
