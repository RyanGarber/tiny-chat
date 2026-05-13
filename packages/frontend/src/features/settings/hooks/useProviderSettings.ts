import { useProviders } from '@/features/input/hooks/useProviders';
import { queryClient, auth, query } from '@/utils/api';
import { useMutation, useQuery } from '@tanstack/react-query';
import { zSettings } from '@tiny-chat/shared/src/types/user';

export const useProviderSettings = () => {
  const session = auth.useSession();
  const { updateProviders } = useProviders();

  const providerSettings = useQuery({
    ...query.settings.get.queryOptions(),
    select: (data) => data.providers,
    initialData: zSettings.safeParse(session.data?.user?.settings).data,
  });

  const setProviderSetting = useMutation({
    ...query.settings.setProviderSetting.mutationOptions(),
    onSuccess: (data) => {
      queryClient.setQueryData(query.settings.get.queryKey(), data);
      updateProviders.mutate();
    },
  });

  const preferredWebProvider = useQuery({
    ...query.settings.get.queryOptions(),
    select: (data) => data.preferredWebProvider,
    initialData: zSettings.safeParse(session.data?.user?.settings).data,
  });

  const setPreferredWebProvider = useMutation({
    ...query.settings.setPreferredWebProvider.mutationOptions(),
    onSuccess: (data) => {
      queryClient.setQueryData(query.settings.get.queryKey(), data);
    },
  });

  const useProviderCache = useQuery({
    ...query.settings.get.queryOptions(),
    select: (data) => data.useProviderCache,
    initialData: zSettings.safeParse(session.data?.user?.settings).data,
  });

  const setUseProviderCache = useMutation({
    ...query.settings.setUseProviderCache.mutationOptions(),
    onSuccess: (data) => {
      queryClient.setQueryData(query.settings.get.queryKey(), data);
    },
  });

  return {
    providerSettings,
    setProviderSetting,
    preferredWebProvider,
    setPreferredWebProvider,
    useProviderCache,
    setUseProviderCache,
  };
};
