import { queryClient } from '@/utils/api';
import { useMutation, useQuery } from '@tanstack/react-query';
import { auth } from '../../../utils/api';
import { ProviderService } from '@/features/provider/services/ProviderService';
import type { zCache } from '@tiny-chat/shared/src/types/user';

export const providerCacheQueryKey = ['cache', 'providers'] as const;
export const providerCacheMutationKey = ['cache', 'providers'] as const;

export const useProviders = () => {
  const session = auth.useSession();

  const providers = useQuery<zCache['providers']>({
    queryKey: providerCacheQueryKey,
    queryFn: () => {
      return ProviderService.getChatProviderCache(session.data!.user);
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const updateProviders = useMutation({
    mutationKey: providerCacheMutationKey,
    mutationFn: () => {
      return ProviderService.updateProviderCache();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(providerCacheQueryKey, data);
    },
  });

  return { providers, updateProviders };
};
