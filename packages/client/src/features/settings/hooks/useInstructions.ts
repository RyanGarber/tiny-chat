import { useMutation } from "@tanstack/react-query";
import { useContext, useMemo } from "react";
import { ClientContext } from "#client/client.ts";
import { useSettings } from "#client/features/settings/hooks/useSettings.ts";
import { SettingsUtils } from "#core/core/utils/SettingsUtils.ts";
import type { ProjectLike } from "#core/features/data/types/chat.ts";

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
