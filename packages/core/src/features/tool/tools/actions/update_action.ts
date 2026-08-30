import { z } from "zod";
import type { ActionsCapability } from "../../../../core/types/capability.ts";
import { zId } from "../../../../core/types/common.ts";
import { CommonUtils } from "../../../../core/utils/CommonUtils.ts";
import { RRule } from "../../../../index.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

export const update_action = {
	name: "update_action",
	description: "Update a scheduled prompt or its schedule.",
	input: z.object({
		id: zId.describe("The ID of the action to update."),
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
		updated_action_id: zId,
	}),
} as const satisfies ToolDefinition;

export const createUpdateActionTool: ToolFactory<
	Tool<typeof update_action, { actions: ActionsCapability }>
> = (options) => ({
	...update_action,
	...options,
	execute: async ({ input, context }) => {
		const action = await options.capabilities.actions.updateAction({
			id: input.id,
			data: [
				[{ id: CommonUtils.getRandomId(), type: "text", value: input.prompt }],
			],
			schedule: input.schedule,
			timezone: context.timezone,
		});
		return [{ type: "json", value: { updated_action_id: action.id } }];
	},
});
