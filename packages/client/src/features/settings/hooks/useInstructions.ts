import { useMutation } from "@tanstack/react-query";
import { useContext, useMemo } from "react";
import { ClientContext } from "../../../client.ts";
import { useSettings } from "./useSettings.ts";

export const useInstructions = () => {
	const client = useContext(ClientContext);

	const { settings, applySettings } = useSettings();

	const instructions = useMemo(() => {
		return settings.data?.instructions ?? [];
	}, [settings.data?.instructions]);

	const addInstruction = useMutation({
		...client.query.settings.addInstruction.mutationOptions(),
		onSuccess: applySettings,
	});

	const editInstruction = useMutation({
		...client.query.settings.editInstruction.mutationOptions(),
		onSuccess: applySettings,
	});

	const removeInstruction = useMutation({
		...client.query.settings.removeInstruction.mutationOptions(),
		onSuccess: applySettings,
	});

	return {
		instructions,
		addInstruction,
		editInstruction,
		removeInstruction,
	};
};
