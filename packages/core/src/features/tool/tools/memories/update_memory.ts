import { z } from "zod";
import { Enum } from "../../../../core/services/PostgresService.ts";
import type { MemoriesCapability } from "../../../../core/types/capability.ts";
import { zId } from "../../../../core/types/common.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

export const update_memory = {
	name: "update_memory",
	description: "Update a fact about the user.",
	input: z.object({
		id: zId,
		fact: z.string().describe("The fact about the user."),
		category: z
			.enum(Enum.MemoryCategory.values)
			.describe("The category the fact belongs to."),
		stability: z
			.enum(Enum.MemoryStability.values)
			.describe("How long the fact is expected to remain true."),
		evidence: z
			.union([z.string(), z.array(z.string())])
			.describe("Evidence to support the fact."),
		confidence: z
			.number()
			.min(0)
			.max(1)
			.describe("Confidence that the fact is accurate and worth remembering."),
	}),
	output: z.object({
		updated_memory_id: zId,
	}),
} as const satisfies ToolDefinition;

export const createUpdateMemoryTool: ToolFactory<
	Tool<typeof update_memory, { memories: MemoriesCapability }>
> = (options) => ({
	...update_memory,
	...options,
	execute: async ({ input }) => {
		const memory = await options.capabilities.memories.updateMemory({
			id: input.id,
			fact: input.fact,
			category: input.category,
			stability: input.stability,
			evidence: Array.isArray(input.evidence)
				? input.evidence
				: [input.evidence],
			confidence: input.confidence,
		});
		return [{ type: "json", value: { updated_memory_id: memory.id } }];
	},
});
