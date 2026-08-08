import { z } from "zod";
import type { ShellCapability } from "../../../capability/types/capability.ts";
import { FileOperationService } from "../../../file/services/FileOperationService.ts";
import { FileExcludeUtils } from "../../../file/utils/FileExcludeUtils.ts";
import { PathUtils } from "../../../file/utils/PathUtils.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

/** Entries a listing returns before it starts costing more than it explains. */
const MAX_ENTRIES = 200;

export const read_dir = {
	name: "read_dir",
	description:
		"List the contents of a directory. Dependency, build and git-ignored directories are omitted. Set recursive to see the tree below it.",
	input: z.object({
		path: z.string().describe("Directory to list."),
		recursive: z
			.boolean()
			.optional()
			.describe("List every descendant instead of the immediate children."),
		max_results: z
			.number()
			.optional()
			.describe("Entries to return at most (default 200)."),
	}),
	output: z.object({
		path: z.string(),
		is_dir: z.boolean(),
	}),
} as const satisfies ToolDefinition;

export const createReadDirTool: ToolFactory<
	Tool<typeof read_dir, { shell: ShellCapability }>
> = (options) => ({
	...read_dir,
	...options,
	execute: async ({ input }) => {
		const limit = Math.min(
			1_000,
			Math.max(1, input.max_results ?? MAX_ENTRIES),
		);

		const entries = input.recursive
			? await FileOperationService.walk({
					shell: options.capabilities.shell,
					path: input.path,
					includeDirectories: true,
				})
			: (await options.capabilities.shell.readDir({ path: input.path })).filter(
					(entry) => FileExcludeUtils.include(entry.path),
				);

		// Directories first, then names, so a listing reads like a file tree.
		const sorted = entries.sort(
			(a, b) =>
				Number(b.is_dir) - Number(a.is_dir) ||
				PathUtils.normalize({ path: a.path, unix: true }).localeCompare(
					PathUtils.normalize({ path: b.path, unix: true }),
				),
		);

		return [
			...sorted.slice(0, limit).map(({ path, is_dir }) => ({
				type: "json" as const,
				value: { path, is_dir },
			})),
			...(sorted.length > limit
				? [
						{
							type: "text" as const,
							value: `Showing ${limit} of ${sorted.length} entries. Use search_files or grep_files to find what you need instead of listing the rest.`,
						},
					]
				: []),
		];
	},
});
