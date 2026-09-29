import { z } from "zod";
import type { Capabilities } from "../../../../core/types/capability.ts";
import type { ToolDisplay } from "../../types/display.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";
import { FileToolUtils } from "../../utils/FileToolUtils.ts";
import { ShellUtils } from "../../utils/ShellUtils.ts";
import { ToolDisplayUtils } from "../../utils/ToolDisplayUtils.ts";

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
	validate: async ({ input, context }) => {
		return {
			approval: FileToolUtils.requiresApproval({ path: input.path, context }),
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
