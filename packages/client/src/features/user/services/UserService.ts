import type { Client } from "../../../client.ts";
import { nextEmbeddingBatchQueryKey } from "../hooks/useEmbedding.ts";

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
	},

	fetchNextEmbeddingBatch: async ({ client }: { client: Client }) => {
		await client.queryClient.invalidateQueries({
			queryKey: nextEmbeddingBatchQueryKey,
		});
	},
} as const;
