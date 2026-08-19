import { z } from "zod";
import type { ShellCapability } from "../../../../core/types/capability.ts";
import { FileOperationService } from "../../../file/services/FileOperationService.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

export const grep_files = {
	name: "grep_files",
	description:
		"Search file contents for a regular expression and return the matching lines with their line numbers. Use this when you know what the code says; use search_files when you only know what it does. This reads text, so images, archives, databases, build output, generated and git-ignored files are all skipped — reach for find_files when you need to know those exist.",
	input: z.object({
		path: z.string().describe("Directory to search."),
		query: z
			.string()
			.describe(
				"Regular expression to match against each line. Case-insensitive unless it contains a capital letter.",
			),
		literal: z
			.boolean()
			.optional()
			.describe(
				"Match the query as plain text instead of a regular expression.",
			),
		case_sensitive: z
			.boolean()
			.optional()
			.describe("Force case sensitivity on or off instead of inferring it."),
		include: z
			.string()
			.optional()
			.describe(
				'Glob limiting which files are searched, e.g. "*.ts" or "src/**/*.test.ts".',
			),
		context: z
			.number()
			.optional()
			.describe("Lines of context to show around each match (0-5, default 0)."),
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

export const createGrepFilesTool: ToolFactory<
	Tool<typeof grep_files, { shell: ShellCapability }>
> = (options) => ({
	...grep_files,
	...options,
	execute: async ({ input }) => {
		const { results, summary } = await FileOperationService.grepFiles({
			shell: options.capabilities.shell,
			path: input.path,
			query: input.query,
			literal: input.literal,
			caseSensitive: input.case_sensitive,
			include: input.include,
			context: Math.min(5, Math.max(0, input.context ?? 0)),
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
