import { useHuggingFaceSettings } from '@/features/settings/hooks/useHuggingFaceSettings';
import { HuggingFaceProvider } from '@/providers/huggingface';
import { query, queryClient, trpc } from '@/utils/api';
import { useMutation, useQuery } from '@tanstack/react-query';
import { auth } from '../../../utils/api';

export const providerCacheQueryKey = ['cache', 'providers'] as const;

export const useProviders = () => {
  const session = auth.useSession();
  const { huggingFaceModels } = useHuggingFaceSettings();

  const providers = useQuery({
    queryKey: [...providerCacheQueryKey, huggingFaceModels.data] as const,
    queryFn: async () => {
      const data = await trpc.persistence.getCache.query();
      if (huggingFaceModels.data?.length) {
        // TODO - super hidden
        data.providers.chat.push({
          ...HuggingFaceProvider,
          models: await HuggingFaceProvider.getModels(session.data!.user),
        });
      }
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
