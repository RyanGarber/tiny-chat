import { z } from "zod";
import type { ShellCapability } from "../../../../core/types/capability.ts";
import { FileSearchService } from "../../../file/services/FileSearchService.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

export const find_files = {
	name: "find_files",
	description:
		"List the files whose paths match a glob, without reading any of them. The cheapest way to learn how a project is laid out, and the way to find files of any type — images, logs, archives and data files are all listed here, including ones the text search tools will not open. Only version-control, dependency and cache directories are left out.",
	input: z.object({
		path: z.string().describe("Directory to search."),
		pattern: z
			.string()
			.describe(
				'Glob to match against paths relative to `path`, e.g. "**/*.test.ts", "src/**/*.{ts,tsx}" or "Dockerfile".',
			),
		max_results: z
			.number()
			.optional()
			.describe("Paths to return at most (default 100)."),
	}),
	output: z.string(),
} as const satisfies ToolDefinition;

export const createFindFilesTool: ToolFactory<
	Tool<typeof find_files, { shell: ShellCapability }>
> = (options) => ({
	...find_files,
	...options,
	execute: async ({ input }) => {
		const { paths, truncated, scanned } = await FileSearchService.glob({
			shell: options.capabilities.shell,
			path: input.path,
			pattern: input.pattern,
			maxResults: Math.min(500, Math.max(1, input.max_results ?? 100)),
		});

		return [
			...paths.map((path) => ({ type: "json" as const, value: path })),
			...(truncated
				? [
						{
							type: "text" as const,
							value: `Showing ${paths.length} path(s); more matched. Narrow the pattern to see the rest.`,
						},
					]
				: []),
			// An empty result is ambiguous between "wrong glob" and "empty
			// directory", and the two call for opposite next moves.
			...(!paths.length && !truncated
				? [
						{
							type: "text" as const,
							value: scanned
								? `No path matched. ${scanned} file(s) were checked against the pattern, so try a broader one such as "**/*" to see what is there.`
								: "No files were found under this path at all. Check the path itself with read_dir.",
						},
					]
				: []),
		];
	},
});
