import { useMutation } from "@tanstack/react-query";
import { SettingsUtils } from "@tiny-chat/core/src/core/utils/SettingsUtils.ts";
import { useContext, useMemo } from "react";
import { ClientContext } from "../../../client.ts";
import { useSettings } from "./useSettings.ts";

export const useThemes = () => {
	const client = useContext(ClientContext);

	const { settings, applySettings } = useSettings();

	const theme = useMemo(() => {
		return SettingsUtils.defaults({ theme: settings.data?.theme }).theme;
	}, [settings.data?.theme]);

	const setTheme = useMutation({
		...client.query.settings.setTheme.mutationOptions(),
		onSuccess: applySettings,
	});

	const codeTheme = useMemo(() => {
		return SettingsUtils.defaults({
			theme: settings.data?.theme,
			codeTheme: settings.data?.codeTheme,
		}).codeTheme;
	}, [settings.data?.theme, settings.data?.codeTheme]);

	const setCodeTheme = useMutation({
		...client.query.settings.setCodeTheme.mutationOptions(),
		onSuccess: applySettings,
	});

	return {
		theme,
		setTheme,
		codeTheme,
		setCodeTheme,
	};
};
