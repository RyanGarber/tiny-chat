import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchNextEmbeddingBatch } from "#frontend/features/config/hooks/useEmbedding.ts";
import { auth, query, queryClient, trpc } from "#frontend/utils/api.ts";
import { zSettings } from "#shared/features/data/types/user.ts";

export const useRetrieval = () => {
	const session = auth.useSession();

	const embeddingConfig = useQuery({
		...query.settings.get.queryOptions(),
		select: (data) => data.embeddingConfig,
		initialData: zSettings.safeParse(session.data?.user?.settings).data,
	});

	const setEmbeddingConfig = useMutation({
		...query.settings.setEmbeddingConfig.mutationOptions(),
		onSuccess: async (data) => {
			queryClient.setQueryData(query.settings.get.queryKey(), data);
			await trpc.embedding.resetAllEmbeddings.mutate();
			await fetchNextEmbeddingBatch();
		},
	});

	const useEmbeddingSearch = useQuery({
		...query.settings.get.queryOptions(),
		select: (data) => data.useEmbeddingSearch,
		initialData: zSettings.safeParse(session.data?.user?.settings).data,
	});

	const setUseEmbeddingSearch = useMutation({
		...query.settings.setUseEmbeddingSearch.mutationOptions(),
		onSuccess: (data) => {
			queryClient.setQueryData(query.settings.get.queryKey(), data);
		},
	});

	return {
		embeddingConfig,
		setEmbeddingConfig,
		useEmbeddingSearch,
		setUseEmbeddingSearch,
	};
};
