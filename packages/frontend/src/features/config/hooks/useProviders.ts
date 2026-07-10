import { useMutation, useQuery } from "@tanstack/react-query";
import { ProviderService } from "#frontend/features/config/services/ProviderService.ts";
import { queryClient } from "#frontend/utils/api.ts";
import type { zCache } from "#shared/types/user.ts";
import { auth } from "../../../utils/api.ts";

export const providerCacheQueryKey = ["cache", "providers"] as const;
export const providerCacheMutationKey = ["cache", "providers"] as const;

export const useProviders = () => {
	const session = auth.useSession();

	const providers = useQuery<zCache["providers"]>({
		queryKey: [...providerCacheQueryKey, session.data?.user?.id ?? ""],
		queryFn: () => {
			if (!session.data) return { chat: [], web: [], other: [] };
			return ProviderService.getChatProviderCache(session.data.user);
		},
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	const updateProviders = useMutation({
		mutationKey: providerCacheMutationKey,
		mutationFn: () => {
			return ProviderService.updateProviderCache();
		},
		onSuccess: (data) => {
			queryClient.setQueryData(providerCacheQueryKey, data);
		},
	});

	return { providers, updateProviders };
};
