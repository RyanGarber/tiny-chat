import { z } from "zod";
import type { ShellCapability } from "../../../capability/types/capability.ts";
import { FileOperationService } from "../../../file/services/FileOperationService.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

export const search_files = {
	name: "search_files",
	description: "Search for files in a directory.",
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

export const createSearchFilesTool: ToolFactory<
	Tool<typeof search_files, { shell: ShellCapability }>
> = (options) => ({
	...search_files,
	...options,
	execute: async ({ input }) => {
		return [
			{
				type: "json",
				value: await FileOperationService.searchFiles({
					shell: options.capabilities.shell,
					path: input.path,
					query: input.query,
				}),
			},
		];
	},
});
