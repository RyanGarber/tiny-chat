import { z } from "zod";
import type { ActionsCapability } from "../../../../core/types/capability.ts";
import { zId } from "../../../../core/types/common.ts";
import { CommonUtils } from "../../../../core/utils/CommonUtils.ts";
import { RRule } from "../../../../index.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

export const create_action = {
	name: "create_action",
	description: "Schedule a prompt to be sent on a recurring schedule.",
	input: z.object({
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
		created_action_id: zId,
	}),
} as const satisfies ToolDefinition;

export const createCreateActionTool: ToolFactory<
	Tool<typeof create_action, { actions: ActionsCapability }>
> = (options) => ({
	...create_action,
	...options,
	execute: async ({ input, context }) => {
		const action = await options.capabilities.actions.createAction({
			data: [
				[{ id: CommonUtils.getRandomId(), type: "text", value: input.prompt }],
			],
			schedule: input.schedule,
			timezone: context.timezone,
		});
		return [{ type: "json", value: { created_action_id: action.id } }];
	},
});
