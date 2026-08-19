import { z } from "zod";
import type { UserCapability } from "../../../../core/types/capability.ts";
import { RRule } from "../../../../index.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

export const update_action = {
	name: "update_action",
	description: "Update a scheduled prompt or its schedule.",
	input: z.object({
		id: z.cuid2().describe("The ID of the action to update."),
		prompt: z.string().describe("The prompt to send to the assistant."),
		schedule: z
			.string()
			.refine((value) => {
				try {
					RRule.fromString(value);
					return true;
				} catch (error) {
					console.warn("failed to parse rrule in tool input:", error);
					return false;
				}
			})
			.describe(
				"The RRule (RFC 5545) schedule to send at. Do not convert - use local time.",
			),
	}),
	output: z.object({
		updated_action_id: z.cuid2(),
	}),
} as const satisfies ToolDefinition;

export const createUpdateActionTool: ToolFactory<
	Tool<typeof update_action, { user: UserCapability }>
> = (options) => ({
	...update_action,
	...options,
	execute: async ({ input, context }) => {
		const action = await options.capabilities.user.updateAction({
			id: input.id,
			data: [[{ type: "text", value: input.prompt }]],
			schedule: input.schedule,
			timezone: context.timezone,
		});
		return [{ type: "json", value: { updated_action_id: action.id } }];
	},
});
