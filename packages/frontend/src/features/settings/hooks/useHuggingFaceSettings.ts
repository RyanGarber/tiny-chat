import { auth, query, queryClient } from '@/utils/api';
import { useMutation, useQuery } from '@tanstack/react-query';
import { zSettings } from '@tiny-chat/shared/src/types/user';

export const useHuggingFaceSettings = () => {
  const session = auth.useSession();

  const huggingFaceModels = useQuery({
    ...query.settings.get.queryOptions(),
    select: (data) => data.huggingFaceModels,
    initialData: zSettings.safeParse(session.data?.user?.settings)?.data,
  });

  const setHuggingFaceModels = useMutation({
    ...query.settings.setHuggingFaceModels.mutationOptions(),
    onSuccess: (data) => {
      queryClient.setQueryData(query.settings.get.queryKey(), data);
    },
  });

  return { huggingFaceModels, setHuggingFaceModels };
};
