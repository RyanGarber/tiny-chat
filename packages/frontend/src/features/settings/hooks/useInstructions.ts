import { queryClient, auth, query } from '@/utils/api';
import { useMutation, useQuery } from '@tanstack/react-query';
import { zSettings } from '@tiny-chat/shared/src/types/user';

export const useInstructions = () => {
  const session = auth.useSession();

  const instructions = useQuery({
    ...query.settings.get.queryOptions(),
    select: (data) => data.instructions,
    initialData: zSettings.safeParse(session.data?.user?.settings).data,
  });

  const addInstruction = useMutation({
    ...query.settings.addInstruction.mutationOptions(),
    onSuccess: (data) => {
      queryClient.setQueryData(query.settings.get.queryKey(), data);
    },
  });

  const editInstruction = useMutation({
    ...query.settings.editInstruction.mutationOptions(),
    onSuccess: (data) => {
      queryClient.setQueryData(query.settings.get.queryKey(), data);
    },
  });

  const removeInstruction = useMutation({
    ...query.settings.removeInstruction.mutationOptions(),
    onSuccess: (data) => {
      queryClient.setQueryData(query.settings.get.queryKey(), data);
    },
  });

  return {
    instructions,
    addInstruction,
    editInstruction,
    removeInstruction,
  };
};
