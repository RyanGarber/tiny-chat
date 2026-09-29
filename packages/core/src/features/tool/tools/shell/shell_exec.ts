import { z } from "zod";
import type { Capabilities } from "../../../../core/types/capability.ts";
import { SettingsUtils } from "../../../../core/utils/SettingsUtils.ts";
import { PathUtils } from "../../../file/utils/PathUtils.ts";
import type { ToolDisplay } from "../../types/display.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";
import { ShellUtils } from "../../utils/ShellUtils.ts";
import { ToolOutputUtils } from "../../utils/ToolOutputUtils.ts";

const MAX_LINE_LENGTH = 2_000;

const MNT_DESCRIPTION = `MUST set to TRUE any time the command should run in the virtual \`${PathUtils.mount}\` filesystem.`;

export const shell_exec = {
	name: "shell_exec",
	description:
		"Execute a shell command. Prefer the dedicated file tools for reading, searching and editing; use this for builds, tests, version control and anything else they do not cover. Long output is truncated in the middle, so pipe through a filter when you need all of it.",
	input: z.object({
		command: z.string(),
		mnt: z.boolean().describe(MNT_DESCRIPTION),
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

/** The programs a command runs, without their arguments: `git status && ls`. */
const getPrograms = (command: string) =>
	command
		.split("&&")
		.map((command) => {
			const parts = command
				.split(" ")
				.filter(Boolean)
				.filter((part) => part !== "--");
			const end = parts.findIndex((part) => /[^A-Za-z0-9-_]/.test(part));
			return parts
				.slice(0, end === -1 ? undefined : end)
				.join(" ")
				.trim();
		})
		.filter(Boolean)
		.join(" && ");

const display: ToolDisplay<typeof shell_exec> = {
	status: ({ input }) => [
		["Running", "Ran"],
		{
			count: ["command", "commands"],
			subject: getPrograms(input.command ?? ""),
		},
	],
	input: ({ input }) => [
		{ type: "code", value: input.command ?? "", language: "bash" },
	],
	output: ({ state, output, stream }) => {
		if (state === "running") {
			return [
				{
					type: "code",
					value: stream.map((line) => line.value).join("\n"),
					terminal: true,
				},
			];
		}
		const [result] = output;
		if (!result) return [];
		const text = [result.stdout.trim(), result.stderr.trim()]
			.filter(Boolean)
			.join("\n");
		return [
			...(text ? [{ type: "code" as const, value: text, terminal: true }] : []),
			...(result.code
				? [
						{
							type: "text" as const,
							value: `Exited with code ${result.code}`,
							tone: "dimmed" as const,
						},
					]
				: []),
		];
	},
};

export const createShellExecTool: ToolFactory<
	Tool<typeof shell_exec, Pick<Capabilities, "shell" | "chatShell">>
> = (options) => ({
	...shell_exec,
	...options,
	display,
	validate: async ({ input, context }) => {
		const { commandWhitelist } = SettingsUtils.of(
			context.user,
			context.chat?.project,
		);
		return { approval: !ShellUtils.isSafe(input.command, commandWhitelist) };
	},
	execute: async ({ input, stream }) => {
		const shell = ShellUtils.detect(input.mnt, options.capabilities);

		let buffer: z.infer<(typeof shell_exec)["stream"]> | undefined;

		const result = await shell.exec({
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
