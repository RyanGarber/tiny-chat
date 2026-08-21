import { z } from "zod";
import type { ShellCapability } from "../../../../core/types/capability.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";
import { ShellUtils } from "../../utils/ShellUtils.ts";
import { ToolOutputUtils } from "../../utils/ToolOutputUtils.ts";

const MAX_LINE_LENGTH = 2_000;

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
	stream: z.object({
		type: z.enum(["stdout", "stderr"]),
		value: z.string(),
	}),
} as const satisfies ToolDefinition;

const keep: (event: z.infer<typeof shell_exec.stream>) => boolean = (event) => {
	return event.value.length > 0;
};

export const createShellExecTool: ToolFactory<
	Tool<typeof shell_exec, { shell: ShellCapability }>
> = (options) => ({
	...shell_exec,
	...options,
	validate: async ({ input }) => {
		return { approval: !ShellUtils.isSafe(input.command) };
	},
	execute: async ({ input, stream }) => {
		let buffer: z.infer<(typeof shell_exec)["stream"]> | undefined;

		const result = await options.capabilities.shell.exec({
			command: input.command,
			stream: ({ type, value }) => {
				// clean shell noise
				const text = value
					.replace(
						// biome-ignore lint/suspicious/noControlCharactersInRegex: matching escapes is the point
						/\u001B\[[0-?]*[ -/]*[@-~]|\u001B][^\u0007]*(?:\u0007|\u001B\\)/g,
						"",
					)
					.replace(/\r\n/g, "\n");
				if (!text) return;

				const pieces = text.split("\n");
				pieces.forEach((piece, index) => {
					if (!buffer || buffer?.type !== type || index > 0) {
						buffer = { type, value: "" };
						stream?.({ mode: "append", data: buffer, options: { keep } });
					}

					// A carriage return rewrites the line it is on, which is how progress
					// bars and spinners report themselves.
					const rewrite = piece.lastIndexOf("\r");
					buffer.value = (
						rewrite >= 0 ? piece.slice(rewrite + 1) : buffer.value + piece
					).slice(0, MAX_LINE_LENGTH);
					stream?.({ mode: "replace", data: buffer, options: { keep } });
				});
			},
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
});
