import { z } from "zod";
import type { Capabilities } from "../../../../core/types/capability.ts";
import { FileOperationService } from "../../../file/services/FileOperationService.ts";
import type { ToolDisplay } from "../../types/display.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";
import { FileToolUtils } from "../../utils/FileToolUtils.ts";
import { ShellUtils } from "../../utils/ShellUtils.ts";
import { ToolDisplayUtils } from "../../utils/ToolDisplayUtils.ts";

export const edit_file = {
	name: "edit_file",
	description:
		"Replace a snippet of an existing file. Prefer this over write_file whenever the file already exists. The result includes the edited lines in context, so there is no need to re-read the file to check the edit landed.",
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
		preview: z.string().optional(),
	}),
} as const satisfies ToolDefinition;

const display: ToolDisplay<typeof edit_file> = {
	status: ({ input }) => [
		["Editing", "Edited"],
		{ count: ["file", "files"] },
		{ subject: ToolDisplayUtils.name(input.path) },
	],
	input: ({ input }) => [
		{
			type: "diff",
			path: input.path,
			before: input.old_string ?? "",
			after: input.new_string ?? "",
			language: ToolDisplayUtils.language(input.path),
		},
	],
};

export const createEditFileTool: ToolFactory<
	Tool<typeof edit_file, Pick<Capabilities, "shell" | "chatShell">>
> = (options) => ({
	...edit_file,
	...options,
	display,
	// Edits read the file and write it back, so two at once lose one.
	sequential: true,
	validate: async ({ input, context }) => {
		const shell = ShellUtils.detect(input.path, options.capabilities);

		await FileOperationService.resolveEdit({
			shell,
			path: input.path,
			old_string: input.old_string,
			new_string: input.new_string,
			replace_all: input.replace_all,
		});
		return {
			approval: FileToolUtils.requiresApproval({ path: input.path, context }),
		};
	},
	execute: async ({ input }) => {
		const shell = ShellUtils.detect(input.path, options.capabilities);

		return [
			{
				type: "json",
				value: await FileOperationService.editFile({
					shell,
					path: input.path,
					old_string: input.old_string,
					new_string: input.new_string,
					replace_all: input.replace_all,
				}),
			},
		];
	},
});
