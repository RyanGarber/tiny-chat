import { query, queryClient, trpc } from '@/utils/api';
import { useMutation, useQuery } from '@tanstack/react-query';
import { auth } from '../../../utils/api';

export const providerCacheQueryKey = ['cache', 'providers'] as const;

export const useProviders = () => {
  const session = auth.useSession();

  const providers = useQuery({
    queryKey: providerCacheQueryKey,
    queryFn: async () => {
      const data = await trpc.persistence.getCache.query();
      // TODO - toggle for enabling WebLLMProvider
      const { WebLLMProvider } = await import('@/providers/webllm');
      data.providers.chat.push({
        ...WebLLMProvider,
        models: await WebLLMProvider.getModels(session.data!.user),
      });
      return data.providers;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const updateProviders = useMutation({
    ...query.persistence.updateCache.mutationOptions(),
    onSuccess: (data) => {
      queryClient.setQueryData(providerCacheQueryKey, data);
    },
  });

  return { providers, updateProviders };
};
