import { useComposerStore } from "#client/features/editor/stores/useComposerStore.ts";
import { ShellCommandService } from "#client/features/shell/services/ShellCommandService.ts";
import { useShellStore } from "#client/features/shell/stores/useShellStore.ts";
import { ShellCommandUtils } from "#client/features/shell/utils/ShellCommandUtils.ts";

/**
 * The editor in shell mode: what it holds starts with `!`, so sending it runs
 * it rather than sending it. The last command run stays up while the editor is
 * in shell mode, and for as long as it runs whatever the editor holds.
 */
export const useShellCommand = () => {
	const text = useComposerStore((s) => s.text);
	const isEditing = useComposerStore((s) => s.mode.kind === "edit");
	const run = useShellStore((s) => s.run);
	const toolsets = useShellStore((s) => s.toolsets);

	const command = isEditing ? null : ShellCommandUtils.parse(text);
	const isRunning = !!run && !run.result;

	return {
		/** What would run, empty for a bare `!`; null when it is a message. */
		command,
		run,
		toolsets,
		isRunning,
		isOpen: command !== null || isRunning,
		dismiss: ShellCommandService.dismiss,
	};
};
