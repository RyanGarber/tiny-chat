import { z } from "zod";
import type { UserContextCapability } from "../../../capability/types/capability.ts";
import type { Tool } from "../../types/tool.ts";

const input = z.object({
	id: z.cuid2(),
	reason: z
		.string()
		.describe(
			"The new fact that warranted deleting the old fact about the user.",
		),
});

const output = z.object({
	deleted_memory_id: z.cuid2(),
});

export const delete_memory: Tool<
	typeof input,
	void,
	typeof output,
	{ userContext: UserContextCapability }
> = {
	name: "delete_memory",
	description: "Delete a fact about the user.",

	input,
	output,

	execute: async ({ input, capabilities }) => {
		const memory = await capabilities.userContext.deleteMemory({
			id: input.id,
		});
		return [{ type: "json", value: { deleted_memory_id: memory.id } }];
	},
};
