import { useMutation } from "@tanstack/react-query";
import { useContext, useMemo } from "react";
import { ClientContext } from "#client/client.ts";
import { useSettings } from "#client/features/settings/hooks/useSettings.ts";
import { UserService } from "#client/features/user/services/UserService.ts";
import { SettingsUtils } from "#core/core/utils/SettingsUtils.ts";

export const useEmbeddingSettings = () => {
	const client = useContext(ClientContext);

	const { settings, applySettings } = useSettings();

	const embeddingConfig = useMemo(() => {
		return SettingsUtils.defaults({
			embeddingConfig: settings.data?.embeddingConfig,
		}).embeddingConfig;
	}, [settings.data?.embeddingConfig]);

	const setEmbeddingConfig = useMutation({
		...client.query.settings.setEmbeddingConfig.mutationOptions(),
		onSuccess: async (data) => {
			applySettings(data);
			await client.api.embedding.resetAllEmbeddings.mutate();
			await UserService.fetchNextEmbeddingBatch({ client });
		},
	});

	const useEmbeddingSearch = useMemo(() => {
		return SettingsUtils.defaults({
			useEmbeddingSearch: settings.data?.useEmbeddingSearch,
		}).useEmbeddingSearch;
	}, [settings.data?.useEmbeddingSearch]);

	const setUseEmbeddingSearch = useMutation({
		...client.query.settings.setUseEmbeddingSearch.mutationOptions(),
		onSuccess: applySettings,
	});

	return {
		embeddingConfig,
		setEmbeddingConfig,
		useEmbeddingSearch,
		setUseEmbeddingSearch,
	};
};
