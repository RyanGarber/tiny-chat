import { useQuery } from '@tanstack/react-query';
import { queryClient, query } from '@/utils/api';

export const refetchMemories = async () => {
  return queryClient.invalidateQueries({
    queryKey: query.persistence.listMemories.pathKey(),
  });
};

export const useMemories = () => {
  const memories = useQuery({
    ...query.persistence.listMemories.queryOptions(),
    select: (data) => data,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return memories;
};
