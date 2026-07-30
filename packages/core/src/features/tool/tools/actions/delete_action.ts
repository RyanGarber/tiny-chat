import { z } from "zod";
import type { UserCapability } from "../../../capability/types/capability.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

export const delete_action = {
	name: "delete_action",
	description: "Delete a scheduled action.",
	input: z.object({
		id: z.cuid2().describe("The ID of the action to delete."),
		reason: z
			.string()
			.optional()
			.describe("The reason for deleting the action."),
	}),
	output: z.object({
		deleted_action_id: z.cuid2(),
	}),
} as const satisfies ToolDefinition;

export const createDeleteActionTool: ToolFactory<
	Tool<typeof delete_action, { user: UserCapability }>
> = (options) => ({
	...delete_action,
	...options,
	execute: async ({ input }) => {
		const action = await options.capabilities.user.deleteAction({
			id: input.id,
		});
		return [{ type: "json", value: { deleted_action_id: action.id } }];
	},
});
