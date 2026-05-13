import { useQuery } from '@tanstack/react-query';
import { useChat } from './useChat';
import { queryClient, query } from '@/utils/api';

export const refetchMemories = async () => {
  return queryClient.invalidateQueries({
    queryKey: query.persistence.listMemories.pathKey(),
  });
};

export const useMemories = () => {
  const activeChat = useChat();

  const memories = useQuery({
    ...query.persistence.listMemories.queryOptions(),
    enabled: !!activeChat.data,
    select: (data) => data,
  });

  return memories;
};
