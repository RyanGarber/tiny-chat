import { useMutation, useQuery } from "@tanstack/react-query";
import { zSettings } from "#core/features/data/types/user.ts";
import { useSession } from "#react/src/core/hooks/useSession.ts";
import { client } from "#ui/client.ts";
import { useProviders } from "#ui/features/config/hooks/useProviders.ts";

export const useProviderSettings = () => {
	const { session } = useSession();
	const { updateProviders } = useProviders();

	const providerSettings = useQuery({
		...client.query.settings.get.queryOptions(),
		select: (data) => data.providers,
		initialData: zSettings.safeParse(session.data?.user?.settings).data,
	});

	const setProviderSetting = useMutation({
		...client.query.settings.setProviderSetting.mutationOptions(),
		onSuccess: (data) => {
			client.queryClient.setQueryData(
				client.query.settings.get.queryKey(),
				data,
			);
			updateProviders.mutate();
		},
	});

	const preferredWebProvider = useQuery({
		...client.query.settings.get.queryOptions(),
		select: (data) => data.preferredWebProvider,
		initialData: zSettings.safeParse(session.data?.user?.settings).data,
	});

	const setPreferredWebProvider = useMutation({
		...client.query.settings.setPreferredWebProvider.mutationOptions(),
		onSuccess: (data) => {
			client.queryClient.setQueryData(
				client.query.settings.get.queryKey(),
				data,
			);
		},
	});

	const useProviderCache = useQuery({
		...client.query.settings.get.queryOptions(),
		select: (data) => data.useProviderCache,
		initialData: zSettings.safeParse(session.data?.user?.settings).data,
	});

	const setUseProviderCache = useMutation({
		...client.query.settings.setUseProviderCache.mutationOptions(),
		onSuccess: (data) => {
			client.queryClient.setQueryData(
				client.query.settings.get.queryKey(),
				data,
			);
		},
	});

	const useBrowserModels = useQuery({
		...client.query.settings.get.queryOptions(),
		select: (data) => data.useBrowserModels,
		initialData: zSettings.safeParse(session.data?.user?.settings).data,
	});

	const setUseBrowserModels = useMutation({
		...client.query.settings.setUseBrowserModels.mutationOptions(),
		onSuccess: (data) => {
			client.queryClient.setQueryData(
				client.query.settings.get.queryKey(),
				data,
			);
		},
	});

	return {
		providerSettings,
		setProviderSetting,
		preferredWebProvider,
		setPreferredWebProvider,
		useProviderCache,
		setUseProviderCache,
		useBrowserModels,
		setUseBrowserModels,
	};
};
