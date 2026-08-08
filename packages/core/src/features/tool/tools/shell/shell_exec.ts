import { z } from "zod";
import type { ShellCapability } from "../../../capability/types/capability.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";
import { ToolOutputUtils } from "../../utils/ToolOutputUtils.ts";

export const shell_exec = {
	name: "shell_exec",
	description:
		"Execute a shell command. Prefer the dedicated file tools for reading, searching and editing; use this for builds, tests, version control and anything else they do not cover. Long output is truncated in the middle, so pipe through a filter when you need all of it.",
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
	execute: async ({ input, onOutput }) => {
		const result = await options.capabilities.shell.exec({
			command: input.command,
			onOutput,
		});
		return [
			{
				type: "json",
				value: {
					code: result.code,
					stdout: ToolOutputUtils.getBounded({
						text: result.stdout,
						label: "stdout",
					}),
					stderr: ToolOutputUtils.getBounded({
						text: result.stderr,
						maxChars: 10_000,
						maxLines: 150,
						label: "stderr",
					}),
				},
			},
		];
	},
	...options,
});
