import { useMutation } from "@tanstack/react-query";
import { useContext, useMemo } from "react";
import { ClientContext } from "../../../client.ts";
import { useSettings } from "./useSettings.ts";

export const useModelSettings = () => {
	const client = useContext(ClientContext);

	const { settings, applySettings } = useSettings();

	const subagentConfig = useMemo(() => {
		return settings.data?.subagentConfig;
	}, [settings.data?.subagentConfig]);

	const setSubagentConfig = useMutation({
		...client.query.settings.setSubagentConfig.mutationOptions(),
		onSuccess: async (data) => {
			applySettings(data);
		},
	});

	const dreamConfig = useMemo(() => {
		return settings.data?.dreamConfig;
	}, [settings.data?.dreamConfig]);

	const setDreamConfig = useMutation({
		...client.query.settings.setDreamConfig.mutationOptions(),
		onSuccess: async (data) => {
			applySettings(data);
		},
	});

	return { subagentConfig, setSubagentConfig, dreamConfig, setDreamConfig };
};
