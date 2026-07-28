import { useMutation, useQuery } from "@tanstack/react-query";
import { auth, query, queryClient } from "#frontend/utils/api.ts";
import { zSettings } from "#shared/features/data/types/user.ts";

export const usePresets = () => {
	const session = auth.useSession();

	const presets = useQuery({
		...query.settings.get.queryOptions(),
		select: (data) => data.presets,
		initialData: zSettings.safeParse(session.data?.user?.settings).data,
	});

	const setPreset = useMutation({
		...query.settings.setPreset.mutationOptions(),
		onSuccess: (data) => {
			queryClient.setQueryData(query.settings.get.queryKey(), data);
		},
	});

	const unsetPreset = useMutation({
		...query.settings.unsetPreset.mutationOptions(),
		onSuccess: (data) => {
			queryClient.setQueryData(query.settings.get.queryKey(), data);
		},
	});

	return { presets, setPreset, unsetPreset };
};
