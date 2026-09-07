import { z } from "zod";
import type { ActionsCapability } from "../../../../core/types/capability.ts";
import { zId } from "../../../../core/types/common.ts";
import { CommonUtils } from "../../../../core/utils/CommonUtils.ts";
import { DataUtils } from "../../../data/utils/DataUtils.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

export const list_actions = {
	name: "list_actions",
	description: "List all scheduled actions.",
	input: z.object({}),
	output: z.object({
		id: zId,
		chat_id: zId,
		prompt: z.string(),
		created_at: z.date(),
		next_run_at: z.date().nullable(),
	}),
} as const satisfies ToolDefinition;

export const createListActionsTool: ToolFactory<
	Tool<typeof list_actions, { actions: ActionsCapability }>
> = (options) => ({
	...list_actions,
	...options,
	execute: async () => {
		const actions = await options.capabilities.actions.getActions();
		return actions.map((action) => ({
			type: "json",
			value: {
				id: action.id,
				chat_id: action.chatId,
				prompt: DataUtils.getText(action),
				created_at: CommonUtils.toDate(action.createdAt),
				next_run_at: CommonUtils.toDate(action.nextRunAt),
			},
		}));
	},
});
