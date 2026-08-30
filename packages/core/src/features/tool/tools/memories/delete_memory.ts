import { z } from "zod";
import type { MemoriesCapability } from "../../../../core/types/capability.ts";
import { zId } from "../../../../core/types/common.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

export const delete_memory = {
	name: "delete_memory",
	description: "Delete a fact about the user.",
	input: z.object({
		id: zId,
		reason: z
			.string()
			.describe(
				"The new fact that warranted deleting the old fact about the user.",
			),
	}),
	output: z.object({
		deleted_memory_id: zId,
	}),
} as const satisfies ToolDefinition;

export const createDeleteMemoryTool: ToolFactory<
	Tool<typeof delete_memory, { memories: MemoriesCapability }>
> = (options) => ({
	...delete_memory,
	...options,
	execute: async ({ input }) => {
		const memory = await options.capabilities.memories.deleteMemory({
			id: input.id,
		});
		return [{ type: "json", value: { deleted_memory_id: memory.id } }];
	},
});
