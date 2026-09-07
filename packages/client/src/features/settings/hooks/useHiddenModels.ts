import { useMutation } from "@tanstack/react-query";
import { SettingsUtils } from "@tiny-chat/core/src/core/utils/SettingsUtils.ts";
import { useContext, useMemo } from "react";
import { ClientContext } from "../../../client.ts";
import { useSettings } from "./useSettings.ts";

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
