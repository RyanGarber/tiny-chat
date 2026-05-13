import { queryClient, auth, query } from '@/utils/api';
import { useMutation, useQuery } from '@tanstack/react-query';

export const useAccounts = () => {
  const accounts = useQuery({
    ...query.settings.listAccounts.queryOptions(),
    select: (data) => data,
  });

  const linkAccount = useMutation({
    mutationFn: async (providerId: string) => {
      await auth.signIn.social({ provider: providerId, callbackURL: window.location.href });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: query.settings.listAccounts.queryKey() });
    },
  });

  const unlinkAccount = useMutation({
    mutationFn: async (providerId: string) => {
      await auth.unlinkAccount({ providerId });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: query.settings.listAccounts.queryKey() });
    },
  });

  const deleteUser = useMutation({
    mutationFn: async () => {
      await auth.deleteUser();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: query.settings.listAccounts.queryKey() });
    },
  });

  return { accounts, linkAccount, unlinkAccount, deleteUser };
};
