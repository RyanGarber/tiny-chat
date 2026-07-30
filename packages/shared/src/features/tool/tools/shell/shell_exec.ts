import { z } from "zod";
import type { ShellCapability } from "../../../capability/types/capability.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

export const shell_exec = {
	name: "shell_exec",
	description: "Execute a shell command.",
	input: z.object({
		command: z.string(),
	}),
	output: z.object({
		code: z.number().optional(),
		stdout: z.string(),
		stderr: z.string(),
	}),
} as const satisfies ToolDefinition;

export const createShellExecTool: ToolFactory<
	Tool<typeof shell_exec, { shell: ShellCapability }>
> = (options) => ({
	...shell_exec,
	execute: async ({ input }) => {
		return [
			{
				type: "json",
				value: await options.capabilities.shell.exec({
					command: input.command,
				}),
			},
		];
	},
	...options,
});
