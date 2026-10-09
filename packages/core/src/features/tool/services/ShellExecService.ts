import type { z } from "zod";
import type { ShellCapability } from "#core/core/types/capability.ts";
import type { StreamMutation } from "#core/core/types/stream.ts";
import type { shell_exec } from "#core/features/tool/tools/shell/shell_exec.ts";
import { ToolOutputUtils } from "#core/features/tool/utils/ToolOutputUtils.ts";

const MAX_LINE_LENGTH = 2_000;

type ShellExecStream = z.infer<(typeof shell_exec)["stream"]>;
type ShellExecOutput = z.infer<(typeof shell_exec)["output"]>;

const keep: (event: ShellExecStream) => boolean = (event) => {
	return event.value.length > 0;
};

/**
 * A command run in a shell the way `shell_exec` runs one, for the model or
 * for the user typing it in themselves, so both see the same output.
 */
export const ShellExecService = {
	/**
	 * Runs `command`, reporting its output a line at a time as it arrives and
	 * resolving with the whole of it, cleaned and bounded.
	 */
	exec: async ({
		shell,
		command,
		stream,
		abort,
	}: {
		shell: ShellCapability;
		command: string;
		stream?: (_: StreamMutation<ShellExecStream>) => void;
		abort?: AbortSignal;
	}): Promise<ShellExecOutput> => {
		const dialect = shell.environment?.().dialect;

		let buffer: ShellExecStream | undefined;

		const result = await shell.exec({
			command,
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

		return {
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
			...(dialect && dialect !== "bash" ? { dialect } : {}),
		};
	},
} as const;
