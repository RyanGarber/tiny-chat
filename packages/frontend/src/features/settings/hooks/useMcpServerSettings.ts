import { useMutation, useQuery } from "@tanstack/react-query";
import { auth, query, queryClient } from "#frontend/utils/api.ts";
import { zSettings } from "#shared/types/user";

export const useMcpServerSettings = () => {
	const session = auth.useSession();

	const mcpServerSettings = useQuery({
		...query.settings.get.queryOptions(),
		select: (data) => data.mcpServers ?? [],
		initialData: zSettings.safeParse(session.data?.user?.settings).data,
	});

	const mcpServerSettingsUnparsed = useQuery({
		...query.settings.getUnparsed.queryOptions(),
		select: (data) => (data as zSettings).mcpServers ?? [],
	});

	const setMcpServerSettings = useMutation({
		...query.settings.setMcpServers.mutationOptions(),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: query.settings.get.queryKey(),
			});
			void queryClient.invalidateQueries({
				queryKey: query.settings.getUnparsed.queryKey(),
			});
		},
	});

	return {
		mcpServerSettings,
		mcpServerSettingsUnparsed,
		setMcpServerSettings,
	};
};
