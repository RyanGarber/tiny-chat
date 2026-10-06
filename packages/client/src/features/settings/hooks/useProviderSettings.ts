import { useMutation } from "@tanstack/react-query";
import { useContext, useMemo } from "react";
import { ClientContext } from "#client/client.ts";
import { useProviders } from "#client/features/agent/hooks/useProviders.ts";
import { useSettings } from "#client/features/settings/hooks/useSettings.ts";
import { SettingsUtils } from "#core/core/utils/SettingsUtils.ts";

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
		onSuccess: (data, variables) =>
			applySettings(data) &&
			updateProviders.mutate({ providers: [variables.provider] }),
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
