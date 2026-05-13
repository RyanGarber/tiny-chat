import { useQuery } from '@tanstack/react-query';
import { useChat } from './useChat';
import { queryClient, query } from '@/utils/api';
import { getNextRunAt } from '@tiny-chat/shared/src/utils.ts';

export const refetchActions = async () => {
  return queryClient.invalidateQueries({
    queryKey: query.persistence.listActions.pathKey(),
  });
};

export const useActions = () => {
  const activeChat = useChat();

  const actions = useQuery({
    ...query.persistence.listActions.queryOptions(),
    enabled: !!activeChat.data,
    select: (data) => data.map((a) => ({ ...a, nextRunAt: getNextRunAt(a) })),
  });

  return actions;
};
