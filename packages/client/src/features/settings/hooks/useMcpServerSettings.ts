import { useMutation, useQuery } from "@tanstack/react-query";
import { zSettings } from "@tiny-chat/core/src/features/data/types/user.ts";
import { useContext } from "react";
import { ClientProvider } from "../../../client.ts";
import { useSession } from "../../../core/hooks/useSession.ts";

export const useMcpServerSettings = () => {
	const client = useContext(ClientProvider);
	const { session } = useSession();

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
