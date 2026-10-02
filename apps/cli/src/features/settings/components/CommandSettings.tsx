import { useShellSettings } from "@tiny-chat/client/features/settings/hooks/useShellSettings.ts";
import type { ProjectLike } from "@tiny-chat/core/features/data/types/chat.ts";
import { useWorkingStatus } from "../../../core/hooks/useWorkingStatus.ts";
import TextList, { type Draft } from "./TextList.tsx";

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
			onSelect={(index) =>
				updateCommand.mutate({
					project,
					index,
					command: { whitelist: !commands[index].whitelist },
				})
			}
			onKey={({ index, input }) => {
				// Enter toggles approval, so the command is written on its own key.
				if (input !== "e" || index === null) return;
				setDraft({ index, text: commands[index].command });
				return true;
			}}
			onRemove={(index) => removeCommand.mutate({ project, index })}
			actions={[
				{ key: "enter", name: "toggle approval" },
				{ key: "e", name: "edit" },
			]}
		/>
	);
}
