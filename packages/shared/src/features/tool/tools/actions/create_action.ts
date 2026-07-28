import { z } from "zod";
import { RRule } from "../../../../index.ts";
import type { UserContextCapability } from "../../../capability/types/capability.ts";
import type { Tool } from "../../types/tool.ts";

const input = z.object({
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
});

const output = z.object({
	created_action_id: z.cuid2(),
});

export const create_action: Tool<
	typeof input,
	void,
	typeof output,
	{ userContext: UserContextCapability }
> = {
	name: "create_action",
	description: "Schedule a prompt to be sent on a recurring schedule.",

	input,
	output,

	execute: async ({ input, capabilities, context }) => {
		const action = await capabilities.userContext.createAction({
			data: [[{ type: "text", value: input.prompt }]],
			schedule: input.schedule,
			timezone: context.timezone,
		});
		return [{ type: "json", value: { created_action_id: action.id } }];
	},
};
