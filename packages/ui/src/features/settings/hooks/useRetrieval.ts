import { useMutation, useQuery } from "@tanstack/react-query";
import { zSettings } from "@tiny-chat/core/src/features/data/types/user.ts";
import { useSession } from "#react/src/core/hooks/useSession.ts";
import { client } from "#ui/client.ts";
import { fetchNextEmbeddingBatch } from "#ui/features/config/hooks/useEmbedding.ts";

export const useRetrieval = () => {
	const { session } = useSession();

	const embeddingConfig = useQuery({
		...client.query.settings.get.queryOptions(),
		select: (data) => data.embeddingConfig,
		initialData: zSettings.safeParse(session.data?.user?.settings).data,
	});

	const setEmbeddingConfig = useMutation({
		...client.query.settings.setEmbeddingConfig.mutationOptions(),
		onSuccess: async (data) => {
			client.queryClient.setQueryData(
				client.query.settings.get.queryKey(),
				data,
			);
			await client.api.embedding.resetAllEmbeddings.mutate();
			await fetchNextEmbeddingBatch();
		},
	});

	const useEmbeddingSearch = useQuery({
		...client.query.settings.get.queryOptions(),
		select: (data) => data.useEmbeddingSearch,
		initialData: zSettings.safeParse(session.data?.user?.settings).data,
	});

	const setUseEmbeddingSearch = useMutation({
		...client.query.settings.setUseEmbeddingSearch.mutationOptions(),
		onSuccess: (data) => {
			client.queryClient.setQueryData(
				client.query.settings.get.queryKey(),
				data,
			);
		},
	});

	return {
		embeddingConfig,
		setEmbeddingConfig,
		useEmbeddingSearch,
		setUseEmbeddingSearch,
	};
};
