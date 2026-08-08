import { useMutation } from "@tanstack/react-query";
import { useContext, useMemo } from "react";
import { ClientContext } from "../../../client.ts";
import { UserService } from "../../user/services/UserService.ts";
import { useSettings } from "./useSettings.ts";

export const useEmbeddingSettings = () => {
	const client = useContext(ClientContext);

	const { settings, applySettings } = useSettings();

	const embeddingConfig = useMemo(() => {
		return settings.data?.embeddingConfig;
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
		return settings.data?.useEmbeddingSearch ?? false;
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
