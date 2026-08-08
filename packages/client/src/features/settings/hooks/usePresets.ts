import { useMutation } from "@tanstack/react-query";
import { useContext, useMemo } from "react";
import { ClientContext } from "../../../client.ts";
import { useSettings } from "./useSettings.ts";

export const usePresets = () => {
	const client = useContext(ClientContext);

	const { settings, applySettings } = useSettings();

	const presets = useMemo(() => {
		return settings.data?.presets ?? {};
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
