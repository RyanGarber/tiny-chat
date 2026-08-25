import { z } from "zod";
import type { Capabilities } from "../../../../core/types/capability.ts";
import { FileSearchService } from "../../../file/services/FileSearchService.ts";
import { PathUtils } from "../../../file/utils/PathUtils.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";
import { ShellUtils } from "../../utils/ShellUtils.ts";

/** Entries a listing returns before it starts costing more than it explains. */
const MAX_ENTRIES = 200;

export const read_dir = {
	name: "read_dir",
	description:
		"List the contents of a directory. Everything in it is shown, whatever its type. Set recursive to see the tree below it, where dependency and version-control directories are listed but not expanded.",
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
		/** Why a directory is shown but its contents are not. */
		not_expanded: z.string().optional(),
	}),
} as const satisfies ToolDefinition;

export const createReadDirTool: ToolFactory<
	Tool<typeof read_dir, Pick<Capabilities, "shell" | "chatShell">>
> = (options) => ({
	...read_dir,
	...options,
	execute: async ({ input }) => {
		const shell = ShellUtils.detect(input.path, options.capabilities);

		const limit = Math.min(
			1_000,
			Math.max(1, input.max_results ?? MAX_ENTRIES),
		);

		// Listing one directory shows all of it: the caller named the directory,
		// so there is nothing here they did not ask for. Only a recursive walk
		// holds back, and only from descending — every entry is still reported.
		const entries: {
			path: string;
			is_dir: boolean;
			skipped?: string;
		}[] = input.recursive
			? (
					await FileSearchService.walk({
						shell,
						path: input.path,
						scope: "listing",
						includeDirectories: true,
					})
				).entries
			: await shell.readDir({ path: input.path });

		// Directories first, then names, so a listing reads like a file tree.
		const sorted = entries.sort(
			(a, b) =>
				Number(b.is_dir) - Number(a.is_dir) ||
				PathUtils.normalize({ path: a.path, unix: true }).localeCompare(
					PathUtils.normalize({ path: b.path, unix: true }),
				),
		);

		return [
			...sorted.slice(0, limit).map(({ path, is_dir, skipped }) => ({
				type: "json" as const,
				value: {
					path,
					is_dir,
					...(skipped ? { not_expanded: skipped } : {}),
				},
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
