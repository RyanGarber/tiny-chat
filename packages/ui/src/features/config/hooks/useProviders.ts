import { useMutation, useQuery } from "@tanstack/react-query";
import type {
	ProviderState,
	ProviderStatus,
} from "@tiny-chat/core/src/features/provider/types/provider.ts";
import { useSession } from "#react/src/core/hooks/useSession.ts";
import { client } from "#ui/client.ts";
import { ProviderService } from "#ui/features/config/services/ProviderService.ts";

const providerCacheQueryKey = ["cache", "providers"] as const;
export const providerCacheMutationKey = ["cache", "providers"] as const;

export const useProviders = () => {
	const { session } = useSession();

	const providers = useQuery<ProviderState<ProviderStatus>[]>({
		queryKey: [...providerCacheQueryKey, session.data?.user?.id ?? ""],
		queryFn: () => {
			if (!session.data) return [];
			return ProviderService.getProviderStateCache(session.data.user);
		},
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	const updateProviders = useMutation({
		mutationKey: providerCacheMutationKey,
		mutationFn: () => {
			if (!session.data) throw new Error("missing session");
			return ProviderService.getProviderStateCache(session.data.user, true);
		},
		onSuccess: async () => {
			await client.queryClient.invalidateQueries({
				queryKey: providerCacheQueryKey,
			});
		},
	});

	return { providers, updateProviders };
};
