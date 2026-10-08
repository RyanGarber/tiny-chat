import { useShellSettings } from "#client/features/settings/hooks/useShellSettings.ts";
import type { ProjectLike } from "#core/features/data/types/chat.ts";
import { useWorkingStatus } from "#tui/core/hooks/useWorkingStatus.ts";
import TextList, {
	type Draft,
} from "#tui/features/settings/components/TextList.tsx";

/** The shell commands of the user, or of one project when given. */
export default function CommandSettings({
	project,
	draft,
	setDraft,
}: {
	project: ProjectLike | null;
	draft: Draft | null;
	setDraft: (draft: Draft | null) => void;
}) {
	const { commands, addCommand, updateCommand, removeCommand } =
		useShellSettings({ project });
	useWorkingStatus(addCommand, updateCommand, removeCommand);

	const toggle = (index: number) =>
		updateCommand.mutate({
			project,
			index,
			command: { whitelist: !commands[index].whitelist },
		});

	return (
		<TextList
			entries={commands.map(({ command, whitelist }) => ({
				text: command,
				detail: whitelist ? "skips approval" : "asks before running",
			}))}
			draft={draft}
			setDraft={setDraft}
			placeholder="command (use * to match anything)"
			onAdd={(command) =>
				addCommand.mutate({ project, command: { command, whitelist: false } })
			}
			onEdit={(index, command) =>
				updateCommand.mutate({ project, index, command: { command } })
			}
			// Enter toggles approval, so the command is written with `e`.
			onSelect={toggle}
			selectName="toggle"
			bindings={{ toggle: { run: toggle } }}
			onRemove={(index) => removeCommand.mutate({ project, index })}
		/>
	);
}
