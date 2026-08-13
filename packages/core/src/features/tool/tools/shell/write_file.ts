import { z } from "zod";
import type { ShellCapability } from "../../../capability/types/capability.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

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
	Tool<typeof write_file, { shell: ShellCapability }>
> = (options) => ({
	...write_file,
	...options,
	validate: async () => {
		return { approval: true };
	},
	execute: async ({ input }) => {
		return [
			{
				type: "json",
				value: await options.capabilities.shell.writeFile({
					path: input.path,
					content: input.content,
				}),
			},
		];
	},
});
