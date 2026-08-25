import { z } from "zod";
import type { Capabilities } from "../../../../core/types/capability.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";
import { ShellUtils } from "../../utils/ShellUtils.ts";

// TODO - replace specific line numbers
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

export const createWriteFileTool: ToolFactory<
	Tool<typeof write_file, Pick<Capabilities, "shell" | "chatShell">>
> = (options) => ({
	...write_file,
	...options,
	validate: async () => {
		return { approval: true };
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
