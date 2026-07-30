import { z } from "zod";
import type { ShellCapability } from "../../../capability/types/capability.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

export const read_dir = {
	name: "read_dir",
	description: "Read the contents of a directory.",
	input: z.object({
		path: z.string(),
	}),
	output: z.array(
		z.object({
			path: z.string(),
			is_dir: z.boolean(),
		}),
	),
} as const satisfies ToolDefinition;

export const createReadDirTool: ToolFactory<
	Tool<typeof read_dir, { shell: ShellCapability }>
> = (options) => ({
	...read_dir,
	...options,
	execute: async ({ input }) => {
		return [
			{
				type: "json",
				value: await options.capabilities.shell.readDir(input),
			},
		];
	},
});
