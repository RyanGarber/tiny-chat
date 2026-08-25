import { z } from "zod";
import type { Capabilities } from "../../../../core/types/capability.ts";
import { FileOperationService } from "../../../file/services/FileOperationService.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";
import { ShellUtils } from "../../utils/ShellUtils.ts";

export const search_files = {
	name: "search_files",
	description:
		"Find the files most relevant to a description or set of keywords, ranked by how well their path and contents match. Use this to locate where something lives; use grep_files once you know the exact text to match. This reads text, so images, archives, databases, build output, generated and git-ignored files are all skipped — reach for find_files when you need to know those exist.",
	input: z.object({
		path: z.string().describe("Directory to search."),
		query: z
			.string()
			.describe(
				"Keywords, an identifier, or a short description of what you are looking for.",
			),
		include: z
			.string()
			.optional()
			.describe(
				'Glob limiting which files are searched, e.g. "*.ts" or "src/**/*.test.ts".',
			),
		max_results: z
			.number()
			.optional()
			.describe("Files to return at most (default 10, maximum 30)."),
	}),
	output: z.object({
		path: z.string(),
		snippet: z.string(),
		matches: z.number().optional(),
	}),
} as const satisfies ToolDefinition;

export const createSearchFilesTool: ToolFactory<
	Tool<typeof search_files, Pick<Capabilities, "shell" | "chatShell">>
> = (options) => ({
	...search_files,
	...options,
	execute: async ({ input }) => {
		const shell = ShellUtils.detect(input.path, options.capabilities);

		const { results, summary } = await FileOperationService.searchFiles({
			shell,
			path: input.path,
			query: input.query,
			include: input.include,
			maxResults: Math.min(30, Math.max(1, input.max_results ?? 10)),
		});

		return [
			...results.map((file) => ({
				type: "json" as const,
				value: {
					path: file.path,
					snippet: file.snippet,
					matches: file.matches,
				},
			})),
			{ type: "text" as const, value: summary },
		];
	},
});
