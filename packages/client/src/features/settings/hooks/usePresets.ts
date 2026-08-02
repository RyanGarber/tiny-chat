import { useMutation, useQuery } from "@tanstack/react-query";
import { zSettings } from "@tiny-chat/core/src/features/data/types/user.ts";
import { useContext } from "react";
import { ClientProvider } from "../../../client.ts";
import { useSession } from "../../../core/hooks/useSession.ts";

export const usePresets = () => {
	const client = useContext(ClientProvider);
	const { session } = useSession();

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
