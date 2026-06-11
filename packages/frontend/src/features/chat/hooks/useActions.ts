import { useQuery } from '@tanstack/react-query';
import { query, queryClient } from '@/utils/api';
import { getNextRunAt } from '@tiny-chat/shared/src/utils.ts';

export const refetchActions = async () => {
  return queryClient.invalidateQueries({
    queryKey: query.context.listActions.pathKey(),
  });
};

export const useActions = () => {
  return useQuery({
    ...query.context.listActions.queryOptions(),
    select: (data) => data.map((a) => ({ ...a, nextRunAt: getNextRunAt(a) })),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
};
