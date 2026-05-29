import { query, queryClient } from '@/utils/api';
import { useMutation, useQuery } from '@tanstack/react-query';

export const useProviders = () => {
  const providers = useQuery({
    ...query.persistence.getCache.queryOptions(),
    select: (data) => data.providers,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const updateProviders = useMutation({
    ...query.persistence.updateCache.mutationOptions(),
    onSuccess: (data) => {
      queryClient.setQueryData(query.persistence.getCache.queryKey(), data);
    },
  });

  return { providers, updateProviders };
};
