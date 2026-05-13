import { queryClient, query } from '@/utils/api';
import { useMutation, useQuery } from '@tanstack/react-query';

export const usePreferredModels = () => {
  const preferredModels = useQuery({
    ...query.settings.get.queryOptions(),
    select: (data) => data.preferredModels,
  });

  const setPreferredModels = useMutation({
    ...query.settings.setPreferredModels.mutationOptions(),
    onSuccess: (data) => {
      queryClient.setQueryData(query.settings.get.queryKey(), data);
    },
  });

  return {
    preferredModels,
    setPreferredModels,
  };
};
