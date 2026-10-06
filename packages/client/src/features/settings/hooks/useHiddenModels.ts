import { useMutation } from "@tanstack/react-query";
import { useContext, useMemo } from "react";
import { ClientContext } from "#client/client.ts";
import { useSettings } from "#client/features/settings/hooks/useSettings.ts";
import { SettingsUtils } from "#core/core/utils/SettingsUtils.ts";

export const useHiddenModels = () => {
	const client = useContext(ClientContext);

	const { settings, applySettings } = useSettings();

	const hiddenModels = useMemo(() => {
		return SettingsUtils.defaults({ hiddenModels: settings.data?.hiddenModels })
			.hiddenModels;
	}, [settings.data?.hiddenModels]);

	const setHiddenModels = useMutation({
		...client.query.settings.setHiddenModels.mutationOptions(),
		onSuccess: applySettings,
	});

	return {
		hiddenModels,
		setHiddenModels,
	};
};
