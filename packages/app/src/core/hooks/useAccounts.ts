import { useMutation, useQuery } from "@tanstack/react-query";
import { client } from "#app/client.ts";

export const useAccounts = () => {
	const accounts = useQuery({
		...client.query.user.getAccounts.queryOptions(),
		select: (data) => data,
	});

	const linkAccount = useMutation({
		mutationFn: async (providerId: string) => {
			await client.auth.signIn.social({
				provider: providerId,
				callbackURL: window.location.href,
			});
		},
		onSuccess: async () => {
			await client.queryClient.invalidateQueries({
				queryKey: client.query.user.getAccounts.queryKey(),
			});
		},
	});

	const unlinkAccount = useMutation({
		mutationFn: async (accountId: string) => {
			await client.auth.unlinkAccount({ accountId });
		},
		onSuccess: async () => {
			await client.queryClient.invalidateQueries({
				queryKey: client.query.user.getAccounts.queryKey(),
			});
		},
	});

	const deleteUser = useMutation({
		mutationFn: async () => {
			await client.auth.deleteUser();
		},
		onSuccess: async () => {
			await client.queryClient.invalidateQueries({
				queryKey: client.query.user.getAccounts.queryKey(),
			});
		},
	});

	return { accounts, linkAccount, unlinkAccount, deleteUser };
};
