import { z } from "zod";
import type { ShellCapability } from "../../../capability/types/capability.ts";
import { FileSearchService } from "../../../file/services/FileSearchService.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

export const find_files = {
	name: "find_files",
	description:
		"List the files whose paths match a glob, without reading any of them. The cheapest way to learn how a project is laid out before searching inside it.",
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
		const { paths, truncated } = await FileSearchService.glob({
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
		];
	},
});
