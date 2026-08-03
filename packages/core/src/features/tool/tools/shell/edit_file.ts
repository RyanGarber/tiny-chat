import { z } from "zod";
import type { ShellCapability } from "../../../capability/types/capability.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

export const edit_file = {
	name: "edit_file",
	description:
		"Replace a snippet of an existing file. Prefer this over write_file whenever the file already exists.",
	input: z.object({
		path: z.string().describe("Path of the file to edit."),
		old_string: z
			.string()
			.describe(
				"Text to replace, copied from the file with enough surrounding lines to appear exactly once.",
			),
		new_string: z
			.string()
			.describe(
				"Text to put in its place. Use an empty string to delete old_string.",
			),
		replace_all: z
			.boolean()
			.optional()
			.describe(
				"Replace every occurrence instead of failing when old_string is not unique.",
			),
	}),
	output: z.object({
		path: z.string(),
		success: z.boolean(),
		replacements: z.number(),
	}),
} as const satisfies ToolDefinition;

export const createEditFileTool: ToolFactory<
	Tool<typeof edit_file, { shell: ShellCapability }>
> = (options) => ({
	...edit_file,
	...options,
	execute: async ({ input }) => {
		return [
			{
				type: "json",
				value: await options.capabilities.shell.editFile({
					path: input.path,
					old_string: input.old_string,
					new_string: input.new_string,
					replace_all: input.replace_all,
				}),
			},
		];
	},
});
