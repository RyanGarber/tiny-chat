import { z } from "zod";
import type { UserContextCapability } from "../../../capability/types/capability.ts";
import { MemoryCategory, MemoryStability } from "../../../data/types/memory.ts";
import type { Tool } from "../../types/tool.ts";

const input = z.object({
	id: z.cuid2(),
	query: z.string(),
});

const output = z.array(
	z.object({
		id: z.cuid2(),
		fact: z.string(),
		category: z.enum(MemoryCategory),
		stability: z.enum(MemoryStability),
		created_at: z.date(),
	}),
);

export const search_memories: Tool<
	typeof input,
	void,
	typeof output,
	{ userContext: UserContextCapability }
> = {
	name: "search_memories",
	description: "Search all known facts about the user.",

	input,
	output,

	execute: async ({ input, capabilities }) => {
		const memories = await capabilities.userContext.searchMemories({
			searchText: input.query,
		});
		return [
			{
				type: "json",
				value: memories.map((memory) => ({
					id: memory.id,
					fact: memory.fact,
					category: memory.category,
					stability: memory.stability,
					created_at: memory.createdAt,
				})),
			},
		];
	},
};
