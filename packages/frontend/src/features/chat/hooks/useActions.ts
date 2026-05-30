import { useQuery } from '@tanstack/react-query';
import { queryClient, query } from '@/utils/api';
import { getNextRunAt } from '@tiny-chat/shared/src/utils.ts';

export const refetchActions = async () => {
  return queryClient.invalidateQueries({
    queryKey: query.persistence.listActions.pathKey(),
  });
};

export const useActions = () => {
  const actions = useQuery({
    ...query.persistence.listActions.queryOptions(),
    select: (data) => data.map((a) => ({ ...a, nextRunAt: getNextRunAt(a) })),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return actions;
};
