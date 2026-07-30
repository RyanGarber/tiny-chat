import { z } from "zod";
import type { ShellCapability } from "../../../capability/types/capability.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

export const grep_files = {
	name: "grep_files",
	description: "Grep for files in a directory.",
	input: z.object({
		path: z.string(),
		query: z.string(),
	}),
	output: z.array(
		z.object({
			path: z.string(),
			snippet: z.string(),
		}),
	),
} as const satisfies ToolDefinition;

export const createGrepFilesTool: ToolFactory<
	Tool<typeof grep_files, { shell: ShellCapability }>
> = (options) => ({
	...grep_files,
	...options,
	execute: async ({ input }) => {
		return [
			{
				type: "json",
				value: await options.capabilities.shell.searchFiles({
					path: input.path,
					query: input.query,
					mode: "grep",
				}),
			},
		];
	},
});
