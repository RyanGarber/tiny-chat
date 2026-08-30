import { z } from "zod";
import type {
	EmbeddingCapability,
	MemoriesCapability,
} from "../../../../core/types/capability.ts";
import { zId } from "../../../../core/types/common.ts";
import { MemoryCategory, MemoryStability } from "../../../data/types/memory.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

export const search_memories = {
	name: "search_memories",
	description: "Search all known facts about the user.",
	input: z.object({
		query: z.string(),
	}),
	output: z.object({
		id: zId,
		fact: z.string(),
		category: z.enum(MemoryCategory),
		stability: z.enum(MemoryStability),
		created_at: z.date(),
		evidence: z.array(z.string()),
		confidence: z.number(),
	}),
} as const satisfies ToolDefinition;

export const createSearchMemoriesTool: ToolFactory<
	Tool<
		typeof search_memories,
		{ embedding?: EmbeddingCapability; memories: MemoriesCapability }
	>
> = (options) => ({
	...search_memories,
	...options,
	execute: async ({ input }) => {
		let embedding: number[] | undefined;
		if (options.capabilities.embedding) {
			try {
				embedding = await options.capabilities.embedding?.runEmbedding({
					text: input.query,
				});
			} catch (error) {
				console.error("error running embedding:", error);
			}
		}
		const memories = await options.capabilities.memories.searchMemories({
			searchText: input.query,
			searchEmbedding: embedding,
		});
		return memories.map((memory) => ({
			type: "json",
			value: {
				id: memory.id,
				fact: memory.fact,
				category: memory.category,
				stability: memory.stability,
				created_at: memory.createdAt,
				evidence: memory.evidence,
				confidence: memory.confidence,
			},
		}));
	},
});
