import { z } from "zod";
import { RRule } from "../../../../index.ts";
import type { UserContextCapability } from "../../../capability/types/capability.ts";
import type { Tool } from "../../types/tool.ts";

const input = z.object({
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
});

const output = z.object({
	updated_action_id: z.cuid2(),
});

export const update_action: Tool<
	typeof input,
	void,
	typeof output,
	{ userContext: UserContextCapability }
> = {
	name: "update_action",
	description: "Update a scheduled prompt to be sent on a recurring schedule.",

	input,
	output,

	execute: async ({ input, capabilities, context }) => {
		const action = await capabilities.userContext.updateAction({
			id: input.id,
			data: [[{ type: "text", value: input.prompt }]],
			schedule: input.schedule,
			timezone: context.timezone,
		});
		return [{ type: "json", value: { updated_action_id: action.id } }];
	},
};
