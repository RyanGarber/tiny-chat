import { useMutation, useQuery } from "@tanstack/react-query";
import { zSettings } from "#core/features/data/types/user.ts";
import { client } from "#ui/client.ts";

export const usePresets = () => {
	const session = client.auth.useSession();

	const presets = useQuery({
		...client.query.settings.get.queryOptions(),
		select: (data) => data.presets,
		initialData: zSettings.safeParse(session.data?.user?.settings).data,
	});

	const setPreset = useMutation({
		...client.query.settings.setPreset.mutationOptions(),
		onSuccess: (data) => {
			client.queryClient.setQueryData(
				client.query.settings.get.queryKey(),
				data,
			);
		},
	});

	const unsetPreset = useMutation({
		...client.query.settings.unsetPreset.mutationOptions(),
		onSuccess: (data) => {
			client.queryClient.setQueryData(
				client.query.settings.get.queryKey(),
				data,
			);
		},
	});

	return { presets, setPreset, unsetPreset };
};
