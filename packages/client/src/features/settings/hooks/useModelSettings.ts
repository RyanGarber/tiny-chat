import { useMutation } from "@tanstack/react-query";
import { SettingsUtils } from "@tiny-chat/core/core/utils/SettingsUtils.ts";
import type { zConfig } from "@tiny-chat/core/features/data/types/message.ts";
import { useCallback, useContext, useMemo } from "react";
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

	/** Saves the subagent config, shown at once so quick edits each build on the last. */
	const updateSubagentConfig = useCallback(
		(config: zConfig | null) => {
			if (settings.data) {
				applySettings({ ...settings.data, subagentConfig: config });
			}
			setSubagentConfig.mutate(
				{ config },
				{ onError: () => void settings.refetch() },
			);
		},
		[settings, applySettings, setSubagentConfig.mutate],
	);

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

	return {
		subagentConfig,
		setSubagentConfig,
		updateSubagentConfig,
		dreamConfig,
		setDreamConfig,
	};
};
