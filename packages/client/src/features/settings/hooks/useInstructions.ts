import { useMutation } from "@tanstack/react-query";
import { SettingsUtils } from "@tiny-chat/core/src/core/utils/SettingsUtils.ts";
import type { FolderLike } from "@tiny-chat/core/src/features/data/types/chat.ts";
import { useContext, useMemo } from "react";
import { ClientContext } from "../../../client.ts";
import { useSettings } from "./useSettings.ts";

export const useInstructions = ({ folder }: { folder?: FolderLike | null }) => {
	const client = useContext(ClientContext);

	const { settings, applySettings } = useSettings({ folder });

	const instructions = useMemo(() => {
		return SettingsUtils.defaults({ instructions: settings.data?.instructions })
			.instructions;
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
		editInstruction,
		removeInstruction,
		memoryBudget,
		setMemoryBudget,
	};
};
