import { queryClient, auth, query } from '@/utils/api';
import { useMutation, useQuery } from '@tanstack/react-query';
import { zSettings } from '@tiny-chat/shared/src/types/user';
import { THEMES, CODE_THEMES } from '@/utils/theme';

export const useThemes = () => {
  const session = auth.useSession();

  const theme = useQuery({
    ...query.settings.get.queryOptions(),
    select: (data) => data.theme as (typeof THEMES)[number],
    initialData: zSettings.safeParse(session.data?.user?.settings).data ?? {
      theme: THEMES[0],
    },
  });

  const setTheme = useMutation({
    ...query.settings.setTheme.mutationOptions(),
    onSuccess: (data) => {
      queryClient.setQueryData(query.settings.get.queryKey(), data);
    },
  });

  const codeTheme = useQuery({
    ...query.settings.get.queryOptions(),
    select: (data) => data.codeTheme as (typeof CODE_THEMES)[number],
    initialData: zSettings.safeParse(session.data?.user?.settings).data ?? {
      codeTheme: CODE_THEMES[0],
    },
  });

  const setCodeTheme = useMutation({
    ...query.settings.setCodeTheme.mutationOptions(),
    onSuccess: (data) => {
      queryClient.setQueryData(query.settings.get.queryKey(), data);
    },
  });

  return {
    theme,
    setTheme,
    codeTheme,
    setCodeTheme,
  };
};
