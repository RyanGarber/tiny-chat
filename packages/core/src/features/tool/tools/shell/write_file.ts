import { z } from "zod";
import type { Capabilities } from "#core/core/types/capability.ts";
import type { ToolDisplay } from "#core/features/tool/types/display.ts";
import type {
	Tool,
	ToolDefinition,
	ToolFactory,
} from "#core/features/tool/types/tool.ts";
import { FileToolUtils } from "#core/features/tool/utils/FileToolUtils.ts";
import { ShellUtils } from "#core/features/tool/utils/ShellUtils.ts";
import { ToolDisplayUtils } from "#core/features/tool/utils/ToolDisplayUtils.ts";

export const write_file = {
	name: "write_file",
	description: "Write content to a file.",
	input: z.object({
		path: z.string(),
		content: z.string(),
	}),
	output: z.object({
		path: z.string(),
		success: z.boolean(),
	}),
} as const satisfies ToolDefinition;

const display: ToolDisplay<typeof write_file> = {
	status: ({ input }) => [
		["Writing", "Wrote"],
		{ count: ["file", "files"] },
		{ subject: ToolDisplayUtils.name(input.path) },
	],
	input: ({ input }) => [
		ToolDisplayUtils.text({ path: input.path, content: input.content }),
	],
};

export const createWriteFileTool: ToolFactory<
	Tool<typeof write_file, Pick<Capabilities, "shell" | "chatShell">>
> = (options) => ({
	...write_file,
	...options,
	display,
	// Writes to one file would race, and the model often makes several.
	sequential: true,
	validate: async ({ input, context }) => {
		return {
			approval: FileToolUtils.requiresApproval({
				path: input.path,
				context,
				shell: options.capabilities.shell,
			}),
		};
	},
	execute: async ({ input }) => {
		const shell = ShellUtils.detect(input.path, options.capabilities);

		return [
			{
				type: "json",
				value: await shell.writeFile({
					path: input.path,
					content: input.content,
				}),
			},
		];
	},
});
