import { z } from "zod";
import type { Capabilities } from "#core/core/types/capability.ts";
import { SettingsUtils } from "#core/core/utils/SettingsUtils.ts";
import { PathUtils } from "#core/features/file/utils/PathUtils.ts";
import type { ToolDisplay } from "#core/features/tool/types/display.ts";
import type {
	Tool,
	ToolDefinition,
	ToolFactory,
} from "#core/features/tool/types/tool.ts";
import { ShellUtils } from "#core/features/tool/utils/ShellUtils.ts";
import { ToolOutputUtils } from "#core/features/tool/utils/ToolOutputUtils.ts";

const MAX_LINE_LENGTH = 2_000;

const MNT_DESCRIPTION = `MUST set to TRUE any time the command should run in the virtual \`${PathUtils.mount}\` filesystem.`;

const BACKGROUND_DESCRIPTION =
	"Set to TRUE to run the command in the background and carry on working meanwhile. Its result is sent to you when it finishes, and your turn does not end until then.";

export const shell_exec = {
	name: "shell_exec",
	description:
		"Execute a shell command. Prefer the dedicated file tools for reading, searching and editing; use this for builds, tests, version control and anything else they do not cover. Long output is truncated in the middle, so pipe through a filter when you need all of it.",
	input: z.object({
		command: z.string(),
		mnt: z.boolean().describe(MNT_DESCRIPTION),
		background: z
			.boolean()
			.optional()
			.describe(
				`${BACKGROUND_DESCRIPTION} Use it for long builds and test runs, not for commands that never exit, like servers.`,
			),
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
		// Results saved before output was cleaned on the way in still carry it.
		const text = [result.stdout, result.stderr]
			.map((value) => ToolOutputUtils.getPlain(value).trim())
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
	background: true,
	validate: async ({ input, context }) => {
		const { commands, folders } = SettingsUtils.of(
			context.user,
			context.chat?.project,
		);
		// Folders live on the user's machine, not in the virtual filesystem.
		const cwd = input.mnt
			? undefined
			: await options.capabilities.shell?.cwd?.().catch(() => undefined);
		return {
			approval: !ShellUtils.isSafe(input.command, commands, {
				folders: input.mnt ? [] : folders,
				cwd,
			}),
		};
	},
	execute: async ({ input, stream, abort }) => {
		const shell = ShellUtils.detect(input.mnt, options.capabilities);

		let buffer: z.infer<(typeof shell_exec)["stream"]> | undefined;

		const result = await shell.exec({
			command: input.command,
			abort,
			stream: ({ type, value }) => {
				// Carriage returns are resolved below, against the line being built.
				const text = ToolOutputUtils.stripAnsi(value);
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
						text: ToolOutputUtils.getPlain(result.stdout),
						label: "stdout",
					}),
					stderr: ToolOutputUtils.getBounded({
						text: ToolOutputUtils.getPlain(result.stderr),
						maxChars: 10_000,
						maxLines: 150,
						label: "stderr",
					}),
				},
			},
		];
	},
});
