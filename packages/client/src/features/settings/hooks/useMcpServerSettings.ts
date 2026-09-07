import { useMutation, useQuery } from "@tanstack/react-query";
import { SettingsUtils } from "@tiny-chat/core/src/core/utils/SettingsUtils.ts";
import { useContext, useMemo } from "react";
import { ClientContext } from "../../../client.ts";
import { useSettings } from "./useSettings.ts";

export const useMcpServerSettings = () => {
	const client = useContext(ClientContext);

	const { settings, applySettings } = useSettings();

	const mcpServerSettings = useMemo(() => {
		return SettingsUtils.defaults({ mcpServers: settings.data?.mcpServers })
			.mcpServers;
	}, [settings.data?.mcpServers]);

	const mcpServerSettingsUnparsed = useQuery({
		...client.query.settings.getRaw.queryOptions({}),
		staleTime: Infinity,
		select: (data) =>
			SettingsUtils.defaults(data as { mcpServers: never }).mcpServers,
	});

	const setMcpServerSettings = useMutation({
		...client.query.settings.setMcpServers.mutationOptions(),
		onSuccess: (data) => {
			applySettings(data);
			void client.queryClient.invalidateQueries({
				queryKey: client.query.settings.getRaw.queryKey(),
			});
		},
	});

	return {
		mcpServerSettings,
		mcpServerSettingsUnparsed,
		setMcpServerSettings,
	};
};
