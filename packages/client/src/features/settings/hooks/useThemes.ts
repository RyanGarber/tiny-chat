import { useMutation } from "@tanstack/react-query";
import { ThemeUtils } from "@tiny-chat/core/src/core/utils/ThemeUtils.ts";
import { useContext, useMemo } from "react";
import { ClientContext } from "../../../client.ts";
import { useSettings } from "./useSettings.ts";

export const useThemes = () => {
	const client = useContext(ClientContext);

	const { settings, applySettings } = useSettings();

	const theme = useMemo(() => {
		return settings.data?.theme ?? ThemeUtils.themes[0];
	}, [settings.data?.theme]);

	const setTheme = useMutation({
		...client.query.settings.setTheme.mutationOptions(),
		onSuccess: applySettings,
	});

	const codeTheme = useMemo(() => {
		return settings.data?.codeTheme ?? ThemeUtils.codeThemesByTheme(theme)[0];
	}, [settings.data?.codeTheme, theme]);

	const setCodeTheme = useMutation({
		...client.query.settings.setCodeTheme.mutationOptions(),
		onSuccess: applySettings,
	});

	const blackout = useMemo(() => {
		return settings.data?.blackout ?? false;
	}, [settings.data?.blackout]);

	const setBlackout = useMutation({
		...client.query.settings.setBlackout.mutationOptions(),
		onSuccess: applySettings,
	});

	return {
		theme,
		setTheme,
		codeTheme,
		setCodeTheme,
		blackout,
		setBlackout,
	};
};
