import { useMutation } from "@tanstack/react-query";
import { SettingsUtils } from "@tiny-chat/core/src/core/utils/SettingsUtils.ts";
import { useContext, useMemo } from "react";
import { ClientContext } from "../../../client.ts";
import { useProviders } from "../../agent/hooks/useProviders.ts";
import { useSettings } from "./useSettings.ts";

export const useProviderSettings = () => {
	const client = useContext(ClientContext);

	const { settings, applySettings } = useSettings();
	const { updateProviders } = useProviders();

	const providerSettings = useMemo(() => {
		return SettingsUtils.defaults({ providers: settings.data?.providers })
			.providers;
	}, [settings.data?.providers]);

	const setProviderSetting = useMutation({
		...client.query.settings.setProviderSetting.mutationOptions(),
		onSuccess: (data) => applySettings(data) && updateProviders.mutate(),
	});

	const preferredWebProvider = useMemo(() => {
		return SettingsUtils.defaults({
			preferredWebProvider: settings.data?.preferredWebProvider,
		}).preferredWebProvider;
	}, [settings.data?.preferredWebProvider]);

	const setPreferredWebProvider = useMutation({
		...client.query.settings.setPreferredWebProvider.mutationOptions(),
		onSuccess: applySettings,
	});

	const useProviderCache = useMemo(() => {
		return SettingsUtils.defaults({
			useProviderCache: settings.data?.useProviderCache,
		}).useProviderCache;
	}, [settings.data?.useProviderCache]);

	const setUseProviderCache = useMutation({
		...client.query.settings.setUseProviderCache.mutationOptions(),
		onSuccess: applySettings,
	});

	const useBrowserModels = useMemo(() => {
		return SettingsUtils.defaults({
			useBrowserModels: settings.data?.useBrowserModels,
		}).useBrowserModels;
	}, [settings.data?.useBrowserModels]);

	const setUseBrowserModels = useMutation({
		...client.query.settings.setUseBrowserModels.mutationOptions(),
		onSuccess: applySettings,
	});

	return {
		providerSettings,
		setProviderSetting,
		preferredWebProvider,
		setPreferredWebProvider,
		useProviderCache,
		setUseProviderCache,
		useBrowserModels,
		setUseBrowserModels,
	};
};
