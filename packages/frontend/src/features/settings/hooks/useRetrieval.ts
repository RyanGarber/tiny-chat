import { queryClient, auth, query, trpc } from '@/utils/api';
import { useMutation, useQuery } from '@tanstack/react-query';
import { zSettings } from '@tiny-chat/shared/src/types/user';

export const useRetrieval = () => {
  const session = auth.useSession();

  const embeddingConfig = useQuery({
    ...query.settings.get.queryOptions(),
    select: (data) => data.embeddingConfig,
    initialData: zSettings.safeParse(session.data?.user?.settings).data,
    refetchInterval: 1000 * 60 * 60, // 1 hour
  });

  const setEmbeddingConfig = useMutation({
    ...query.settings.setEmbeddingConfig.mutationOptions(),
    onSuccess: async (data) => {
      queryClient.setQueryData(query.settings.get.queryKey(), data);
      await trpc.embeddings.reset.mutate();
      // TODO - regenerate embeddings (or have backend do it automatically)
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
