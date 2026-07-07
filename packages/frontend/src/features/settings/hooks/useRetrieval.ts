import { fetchNextEmbeddingBatch } from '@/features/config/hooks/useEmbedding.ts';
import { auth, query, queryClient, trpc } from '@/utils/api';
import { useMutation, useQuery } from '@tanstack/react-query';
import { zSettings } from '@tiny-chat/shared/src/types/user';

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
      await trpc.context.resetEmbeddings.mutate();
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
