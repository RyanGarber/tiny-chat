import { z } from "zod";
import type { UserContextCapability } from "../../../capability/types/capability.ts";
import { MemoryCategory, MemoryStability } from "../../../data/types/memory.ts";
import type { Tool } from "../../types/tool.ts";

const input = z.object({
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
});

const output = z.object({
	created_memory_id: z.cuid2(),
});

export const create_memory: Tool<
	typeof input,
	void,
	typeof output,
	{ userContext: UserContextCapability }
> = {
	name: "create_memory",
	description: "Remember a fact about the user.",

	input,
	output,

	execute: async ({ input, capabilities }) => {
		const memory = await capabilities.userContext.createMemory({
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
};
