import { z } from "zod";
import type { ActionsCapability } from "#core/core/types/capability.ts";
import { zId } from "#core/core/types/common.ts";
import { CommonUtils } from "#core/core/utils/CommonUtils.ts";
import type { ToolDisplay } from "#core/features/tool/types/display.ts";
import type {
	Tool,
	ToolDefinition,
	ToolFactory,
} from "#core/features/tool/types/tool.ts";
import { RRule } from "#core/index.ts";

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

const display: ToolDisplay<typeof create_action> = {
	status: ({ input }) => [
		["Scheduling", "Scheduled"],
		{ count: ["action", "actions"] },
		{ subject: input.prompt ?? "" },
	],
	input: ({ input }) => [
		{
			type: "record",
			title: input.prompt ?? "",
			details: [CommonUtils.describeSchedule(input.schedule)],
		},
	],
};

export const createCreateActionTool: ToolFactory<
	Tool<typeof create_action, { actions: ActionsCapability }>
> = (options) => ({
	...create_action,
	...options,
	display,
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
