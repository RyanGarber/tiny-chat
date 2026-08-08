import { z } from "zod";
import type { WebCapability } from "../../../capability/types/capability.ts";
import { zWebContext } from "../../../provider/types/web.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

export const search_web = {
	name: "search_web",
	description: "View the contents of any URL.",
	input: z.object({
		query: z.string(),
		maxResults: z.number().optional().default(5),
	}),
	output: zWebContext,
} as const satisfies ToolDefinition;

export const createSearchWebTool: ToolFactory<
	Tool<typeof search_web, { provider: WebCapability }>
> = (options) => ({
	...search_web,
	...options,
	execute: async ({ input }) => {
		return (
			await options.capabilities.provider.search({
				query: input.query,
				maxResults: input.maxResults,
			})
		).map((result) => ({
			type: "json",
			value: result,
		}));
	},
});
