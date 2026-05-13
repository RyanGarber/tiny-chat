import { queryClient, auth, query } from '@/utils/api';
import { useMutation, useQuery } from '@tanstack/react-query';
import { zSettings } from '@tiny-chat/shared/src/types/user';

export const useMcpServerSettings = () => {
  const session = auth.useSession();

  const mcpServerSettings = useQuery({
    ...query.settings.get.queryOptions(),
    select: (data) => data.mcpServers,
    initialData: zSettings.safeParse(session.data?.user?.settings).data,
  });

  const setMcpServerSettings = useMutation({
    ...query.settings.setMcpServers.mutationOptions(),
    onSuccess: (data) => {
      queryClient.setQueryData(query.settings.get.queryKey(), data);
    },
  });

  return {
    mcpServerSettings,
    setMcpServerSettings,
  };
};
