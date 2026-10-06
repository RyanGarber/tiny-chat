import { useMutation } from "@tanstack/react-query";
import { useContext, useMemo } from "react";
import { ClientContext } from "#client/client.ts";
import { useSettings } from "#client/features/settings/hooks/useSettings.ts";
import { SettingsUtils } from "#core/core/utils/SettingsUtils.ts";

export const usePresets = () => {
	const client = useContext(ClientContext);

	const { settings, applySettings } = useSettings();

	const presets = useMemo(() => {
		return SettingsUtils.defaults({ presets: settings.data?.presets }).presets;
	}, [settings.data?.presets]);

	const setPreset = useMutation({
		...client.query.settings.setPreset.mutationOptions(),
		onSuccess: applySettings,
	});

	const unsetPreset = useMutation({
		...client.query.settings.unsetPreset.mutationOptions(),
		onSuccess: applySettings,
	});

	return { presets, setPreset, unsetPreset };
};
