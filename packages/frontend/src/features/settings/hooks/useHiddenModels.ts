import { queryClient, query } from '@/utils/api';
import { useMutation, useQuery } from '@tanstack/react-query';

export const useHiddenModels = () => {
  const hiddenModels = useQuery({
    ...query.settings.get.queryOptions(),
    select: (data) => data.hiddenModels,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const setHiddenModels = useMutation({
    ...query.settings.setHiddenModels.mutationOptions(),
    onSuccess: (data) => {
      queryClient.setQueryData(query.settings.get.queryKey(), data);
    },
  });

  return {
    hiddenModels,
    setHiddenModels,
  };
};
