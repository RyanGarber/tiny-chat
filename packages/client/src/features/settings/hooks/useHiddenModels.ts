import { useMutation } from "@tanstack/react-query";
import { useContext, useMemo } from "react";
import { ClientContext } from "../../../client.ts";
import { useSettings } from "./useSettings.ts";

export const useHiddenModels = () => {
	const client = useContext(ClientContext);

	const { settings, applySettings } = useSettings();

	const hiddenModels = useMemo(() => {
		return settings.data?.hiddenModels ?? {};
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
