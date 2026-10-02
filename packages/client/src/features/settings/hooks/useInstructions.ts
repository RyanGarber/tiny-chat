import { useMutation } from "@tanstack/react-query";
import { SettingsUtils } from "@tiny-chat/core/core/utils/SettingsUtils.ts";
import type { ProjectLike } from "@tiny-chat/core/features/data/types/chat.ts";
import { useContext, useMemo } from "react";
import { ClientContext } from "../../../client.ts";
import { useSettings } from "./useSettings.ts";

export const useInstructions = ({
	project,
}: {
	project?: ProjectLike | null;
}) => {
	const client = useContext(ClientContext);

	const { settings, applySettings } = useSettings({ project });

	const instructions = useMemo(() => {
		return SettingsUtils.defaults({ instructions: settings.data?.instructions })
			.instructions;
	}, [settings.data?.instructions]);

	const addInstruction = useMutation({
		...client.query.settings.addInstruction.mutationOptions(),
		onSuccess: applySettings,
	});

	const updateInstruction = useMutation({
		...client.query.settings.updateInstruction.mutationOptions(),
		onSuccess: applySettings,
	});

	const removeInstruction = useMutation({
		...client.query.settings.removeInstruction.mutationOptions(),
		onSuccess: applySettings,
	});

	const memoryBudget = useMemo(() => {
		return SettingsUtils.defaults({ memoryBudget: settings.data?.memoryBudget })
			.memoryBudget;
	}, [settings.data?.memoryBudget]);

	const setMemoryBudget = useMutation({
		...client.query.settings.setMemoryBudget.mutationOptions(),
		onSuccess: applySettings,
	});

	return {
		instructions,
		addInstruction,
		updateInstruction,
		removeInstruction,
		memoryBudget,
		setMemoryBudget,
	};
};
