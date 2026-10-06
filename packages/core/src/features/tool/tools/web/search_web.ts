import { z } from "zod";
import type { WebCapability } from "#core/core/types/capability.ts";
import { zWebContext } from "#core/features/provider/types/web.ts";
import type { ToolDisplay } from "#core/features/tool/types/display.ts";
import type {
	Tool,
	ToolDefinition,
	ToolFactory,
} from "#core/features/tool/types/tool.ts";

export const search_web = {
	name: "search_web",
	description: "View the contents of any URL.",
	input: z.object({
		query: z.string(),
		maxResults: z.number().optional().default(5),
	}),
	output: zWebContext,
} as const satisfies ToolDefinition;

const display: ToolDisplay<typeof search_web> = {
	status: ({ input }) => [
		["Searching web for", "Searched web for"],
		{ count: ["query", "queries"], subject: input.query ?? "" },
	],
	output: ({ output }) => output.map((source) => ({ type: "web", source })),
};

export const createSearchWebTool: ToolFactory<
	Tool<typeof search_web, { web: WebCapability }>
> = (options) => ({
	...search_web,
	...options,
	display,
	execute: async ({ input }) => {
		return (
			await options.capabilities.web.search({
				query: input.query,
				maxResults: input.maxResults,
			})
		).map((result) => ({
			type: "json",
			value: result,
		}));
	},
});
