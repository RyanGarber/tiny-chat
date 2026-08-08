import { useMutation, useQuery } from "@tanstack/react-query";
import type { zSettings } from "@tiny-chat/core/src/features/data/types/user.ts";
import { useContext, useMemo } from "react";
import { ClientContext } from "../../../client.ts";
import { useSettings } from "./useSettings.ts";

export const useMcpServerSettings = () => {
	const client = useContext(ClientContext);

	const { settings, applySettings } = useSettings();

	const mcpServerSettings = useMemo(() => {
		return settings.data?.mcpServers ?? {};
	}, [settings.data?.mcpServers]);

	const mcpServerSettingsUnparsed = useQuery({
		...client.query.settings.getUnparsed.queryOptions(),
		staleTime: Infinity,
		select: (data) => (data as zSettings).mcpServers ?? {},
	});

	const setMcpServerSettings = useMutation({
		...client.query.settings.setMcpServers.mutationOptions(),
		onSuccess: (data) => {
			applySettings(data);
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
