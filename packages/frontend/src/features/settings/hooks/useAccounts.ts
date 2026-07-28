import { useMutation, useQuery } from "@tanstack/react-query";
import { auth, query, queryClient } from "#frontend/utils/api.ts";

export const useAccounts = () => {
	const accounts = useQuery({
		...query.user.getAccounts.queryOptions(),
		select: (data) => data,
	});

	const linkAccount = useMutation({
		mutationFn: async (providerId: string) => {
			await auth.signIn.social({
				provider: providerId,
				callbackURL: window.location.href,
			});
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: query.user.getAccounts.queryKey(),
			});
		},
	});

	const unlinkAccount = useMutation({
		mutationFn: async (providerId: string) => {
			await auth.unlinkAccount({ providerId });
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: query.user.getAccounts.queryKey(),
			});
		},
	});

	const deleteUser = useMutation({
		mutationFn: async () => {
			await auth.deleteUser();
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: query.user.getAccounts.queryKey(),
			});
		},
	});

	return { accounts, linkAccount, unlinkAccount, deleteUser };
};
