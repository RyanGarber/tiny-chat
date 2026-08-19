import { z } from "zod";
import type { UserCapability } from "../../../../core/types/capability.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

export const delete_memory = {
	name: "delete_memory",
	description: "Delete a fact about the user.",
	input: z.object({
		id: z.cuid2(),
		reason: z
			.string()
			.describe(
				"The new fact that warranted deleting the old fact about the user.",
			),
	}),
	output: z.object({
		deleted_memory_id: z.cuid2(),
	}),
} as const satisfies ToolDefinition;

export const createDeleteMemoryTool: ToolFactory<
	Tool<typeof delete_memory, { user: UserCapability }>
> = (options) => ({
	...delete_memory,
	...options,
	execute: async ({ input }) => {
		const memory = await options.capabilities.user.deleteMemory({
			id: input.id,
		});
		return [{ type: "json", value: { deleted_memory_id: memory.id } }];
	},
});
