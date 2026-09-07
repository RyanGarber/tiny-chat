import { useMutation } from "@tanstack/react-query";
import { SettingsUtils } from "@tiny-chat/core/src/core/utils/SettingsUtils.ts";
import { useContext, useMemo } from "react";
import { ClientContext } from "../../../client.ts";
import { useSettings } from "./useSettings.ts";

export const useModelSettings = () => {
	const client = useContext(ClientContext);

	const { settings, applySettings } = useSettings();

	const subagentConfig = useMemo(() => {
		return SettingsUtils.defaults({
			subagentConfig: settings.data?.subagentConfig,
		}).subagentConfig;
	}, [settings.data?.subagentConfig]);

	const setSubagentConfig = useMutation({
		...client.query.settings.setSubagentConfig.mutationOptions(),
		onSuccess: async (data) => {
			applySettings(data);
		},
	});

	const dreamConfig = useMemo(() => {
		return SettingsUtils.defaults({ dreamConfig: settings.data?.dreamConfig })
			.dreamConfig;
	}, [settings.data?.dreamConfig]);

	const setDreamConfig = useMutation({
		...client.query.settings.setDreamConfig.mutationOptions(),
		onSuccess: async (data) => {
			applySettings(data);
		},
	});

	return { subagentConfig, setSubagentConfig, dreamConfig, setDreamConfig };
};
