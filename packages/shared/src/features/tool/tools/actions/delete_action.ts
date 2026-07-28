import { z } from "zod";
import type { UserContextCapability } from "../../../capability/types/capability.ts";
import type { Tool } from "../../types/tool.ts";

const input = z.object({
	id: z.cuid2().describe("The ID of the action to delete."),
	reason: z.string().optional().describe("The reason for deleting the action."),
});

const output = z.object({
	deleted_action_id: z.cuid2(),
});

export const delete_action: Tool<
	typeof input,
	void,
	typeof output,
	{ userContext: UserContextCapability }
> = {
	name: "delete_action",
	description: "Update a scheduled prompt to be sent on a recurring schedule.",

	input,
	output,

	execute: async ({ input, capabilities }) => {
		const action = await capabilities.userContext.deleteAction({
			id: input.id,
		});
		return [{ type: "json", value: { deleted_action_id: action.id } }];
	},
};
