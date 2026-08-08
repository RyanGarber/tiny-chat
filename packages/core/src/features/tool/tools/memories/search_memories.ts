import { z } from "zod";
import type { UserCapability } from "../../../capability/types/capability.ts";
import { MemoryCategory, MemoryStability } from "../../../data/types/memory.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

export const search_memories = {
	name: "search_memories",
	description: "Search all known facts about the user.",
	input: z.object({
		query: z.string(),
	}),
	output: z.object({
		id: z.cuid2(),
		fact: z.string(),
		category: z.enum(MemoryCategory),
		stability: z.enum(MemoryStability),
		created_at: z.date(),
	}),
} as const satisfies ToolDefinition;

export const createSearchMemoriesTool: ToolFactory<
	Tool<typeof search_memories, { user: UserCapability }>
> = (options) => ({
	...search_memories,
	...options,
	execute: async ({ input }) => {
		const memories = await options.capabilities.user.searchMemories({
			searchText: input.query,
		});
		return memories.map((memory) => ({
			type: "json",
			value: {
				id: memory.id,
				fact: memory.fact,
				category: memory.category,
				stability: memory.stability,
				created_at: memory.createdAt,
			},
		}));
	},
});
