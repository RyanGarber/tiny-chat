import { z } from "zod";
import type { ActionsCapability } from "../../../../core/types/capability.ts";
import { zId } from "../../../../core/types/common.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

export const delete_action = {
	name: "delete_action",
	description: "Delete a scheduled action.",
	input: z.object({
		id: zId.describe("The ID of the action to delete."),
		reason: z.string().describe("The reason for deleting the action."),
	}),
	output: z.object({
		deleted_action_id: zId,
	}),
} as const satisfies ToolDefinition;

export const createDeleteActionTool: ToolFactory<
	Tool<typeof delete_action, { actions: ActionsCapability }>
> = (options) => ({
	...delete_action,
	...options,
	execute: async ({ input }) => {
		const action = await options.capabilities.actions.deleteAction({
			id: input.id,
		});
		return [{ type: "json", value: { deleted_action_id: action.id } }];
	},
});
