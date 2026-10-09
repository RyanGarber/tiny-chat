import type { Client } from "#client/client.ts";
import { createChatShellCapability } from "#client/core/capabilities/createChatShellCapability.ts";
import { createShellCapability } from "#client/core/capabilities/createShellCapability.ts";
import { ToolStreamService } from "#client/core/services/StreamService.ts";
import { useChatStore } from "#client/features/chat/stores/useChatStore.ts";
import {
	type ShellRun,
	useShellStore,
} from "#client/features/shell/stores/useShellStore.ts";
import type { Capabilities } from "#core/core/types/capability.ts";
import { CommonUtils } from "#core/core/utils/CommonUtils.ts";
import { ShellExecService } from "#core/features/tool/services/ShellExecService.ts";
import { shell_exec } from "#core/features/tool/tools/shell/shell_exec.ts";
import { createShellToolset } from "#core/features/tool/tools/shell.ts";
import { ShellUtils } from "#core/features/tool/utils/ShellUtils.ts";

/** Commands the user runs themselves, by starting what they write with `!`. */
export const ShellCommandService = {
	/**
	 * Runs a command in the user's own shell, in the chat's folder, or in the
	 * chat's virtual filesystem where there is no shell to run it in (the web).
	 * Only one runs at a time; it is stopped through its tool call's interrupt.
	 */
	run: async ({ client, command }: { client: Client; command: string }) => {
		const { run: current, setRun } = useShellStore.getState();
		if (!command || (current && !current.result)) return;

		const id = CommonUtils.getRandomId();
		const input = { command, mnt: !client.shell };
		const call = {
			type: "toolCall" as const,
			id,
			name: shell_exec.name,
			input,
		};
		// Taken at once, so a second command sent meanwhile waits its turn.
		const abort = ToolStreamService.start(id);
		setRun(call);

		const settle = (result: ShellRun["result"]) => {
			ToolStreamService.clear(id);
			if (useShellStore.getState().run?.id === id) setRun({ ...call, result });
		};

		try {
			const chat = useChatStore.getState().active.chatId ?? undefined;
			const capabilities: Pick<Capabilities, "shell" | "chatShell"> =
				client.shell
					? { shell: await createShellCapability({ client }) }
					: { chatShell: await createChatShellCapability({ client, chat }) };
			// The toolset the model would have run it from, which is where its
			// display is found.
			setRun(call, [
				await createShellToolset({ capabilities, status: { valid: true } }),
			]);

			const value = await ShellExecService.exec({
				shell: ShellUtils.detect(input.mnt, capabilities),
				command,
				abort: abort.signal,
				stream: (mutation) => ToolStreamService.mutate(id, mutation),
			});
			settle({
				type: "toolResult",
				id,
				name: shell_exec.name,
				output: [{ type: "json", id: CommonUtils.getRandomId(), value }],
			});
		} catch (error) {
			settle({
				type: "toolResult",
				id,
				name: shell_exec.name,
				error: true,
				output: [
					{
						type: "text",
						id: CommonUtils.getRandomId(),
						value: error instanceof Error ? error.message : String(error),
					},
				],
			});
		}
	},

	/** Puts the last command's output away, unless it is still running. */
	dismiss: () => {
		const { run, setRun } = useShellStore.getState();
		if (run?.result) setRun(null);
	},
} as const;
