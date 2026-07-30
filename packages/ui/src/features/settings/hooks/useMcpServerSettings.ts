import { useMutation, useQuery } from "@tanstack/react-query";
import { zSettings } from "#core/features/data/types/user.ts";
import { client } from "#ui/client.ts";

export const useMcpServerSettings = () => {
	const session = client.auth.useSession();

	const mcpServerSettings = useQuery({
		...client.query.settings.get.queryOptions(),
		select: (data) => data.mcpServers ?? {},
		initialData: zSettings.safeParse(session.data?.user?.settings).data,
	});

	const mcpServerSettingsUnparsed = useQuery({
		...client.query.settings.getUnparsed.queryOptions(),
		select: (data) => (data as zSettings).mcpServers ?? {},
	});

	const setMcpServerSettings = useMutation({
		...client.query.settings.setMcpServers.mutationOptions(),
		onSuccess: () => {
			void client.queryClient.invalidateQueries({
				queryKey: client.query.settings.get.queryKey(),
			});
			void client.queryClient.invalidateQueries({
				queryKey: client.query.settings.getUnparsed.queryKey(),
			});
		},
	});

	return {
		mcpServerSettings,
		mcpServerSettingsUnparsed,
		setMcpServerSettings,
	};
};
