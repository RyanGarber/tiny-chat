import { useMutation, useQuery } from "@tanstack/react-query";
import { useContext } from "react";
import { ClientProvider } from "../../../client.ts";
import { useSession } from "../../../core/hooks/useSession.ts";
import { ProviderService } from "../services/ProviderService.ts";

const providerCacheQueryKey = ["cache", "providers"] as const;
export const providerCacheMutationKey = ["cache", "providers"] as const;

export const useProviders = () => {
	const client = useContext(ClientProvider);

	const { session } = useSession();

	const providers = useQuery({
		queryKey: [...providerCacheQueryKey, session.data?.user?.id ?? ""],
		queryFn: () => {
			if (!session.data) return [];
			return ProviderService.getProviderStates({
				client,
				user: session.data.user,
			});
		},
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	const updateProviders = useMutation({
		mutationKey: providerCacheMutationKey,
		mutationFn: async () => {
			if (!session.data) throw new Error("missing session");
			console.log("[useProviders] updating providers...");
			await ProviderService.getProviderStates({
				client,
				user: session.data.user,
				update: true,
			});
			await providers.refetch();
			console.log("[useProviders] updated:", providers.data);
		},
	});

	return { providers, updateProviders };
};
