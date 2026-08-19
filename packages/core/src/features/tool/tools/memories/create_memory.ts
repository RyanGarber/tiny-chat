import { z } from "zod";
import type { UserCapability } from "../../../../core/types/capability.ts";
import { MemoryCategory, MemoryStability } from "../../../data/types/memory.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

export const create_memory = {
	name: "create_memory",
	description: "Remember a fact about the user.",
	input: z.object({
		fact: z.string().describe("The fact about the user."),
		category: z
			.enum(MemoryCategory)
			.describe("The category the fact belongs to."),
		stability: z
			.enum(MemoryStability)
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
		created_memory_id: z.cuid2(),
	}),
} as const satisfies ToolDefinition;

export const createCreateMemoryTool: ToolFactory<
	Tool<typeof create_memory, { user: UserCapability }>
> = (options) => ({
	...create_memory,
	...options,
	execute: async ({ input }) => {
		const memory = await options.capabilities.user.createMemory({
			fact: input.fact,
			category: input.category,
			stability: input.stability,
			evidence: Array.isArray(input.evidence)
				? input.evidence
				: [input.evidence],
			confidence: input.confidence,
		});
		return [{ type: "json", value: { created_memory_id: memory.id } }];
	},
});
