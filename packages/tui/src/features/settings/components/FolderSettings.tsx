import { useShellSettings } from "#client/features/settings/hooks/useShellSettings.ts";
import type { ProjectLike } from "#core/features/data/types/chat.ts";
import { useWorkingStatus } from "#tui/core/hooks/useWorkingStatus.ts";
import TextList, {
	type Draft,
} from "#tui/features/settings/components/TextList.tsx";

/** The shell folders of the user, or of one project when given. */
export default function FolderSettings({
	project,
	draft,
	setDraft,
}: {
	project: ProjectLike | null;
	draft: Draft | null;
	setDraft: (draft: Draft | null) => void;
}) {
	const { folders, folderStatus, addFolder, removeFolder, updateFolder } =
		useShellSettings({ project });
	useWorkingStatus(addFolder, updateFolder, removeFolder);

	return (
		<TextList
			entries={folders.map(({ path, whitelist }) => ({
				text: path,
				detail: [
					whitelist ? "skips approval for edits" : "asks before edits",
					folderStatus.data?.[path] === false ? "unavailable" : undefined,
				]
					.filter(Boolean)
					.join(" · "),
				error: folderStatus.data?.[path] === false,
			}))}
			draft={draft}
			setDraft={setDraft}
			placeholder="add folder"
			onAdd={(path) =>
				addFolder.mutate({ project, folder: { path, whitelist: false } })
			}
			onSelect={(index) =>
				updateFolder.mutate({
					project,
					index,
					folder: { whitelist: !folders[index].whitelist },
				})
			}
			onRemove={(index) => removeFolder.mutate({ project, index })}
			actions={[{ key: "enter", name: "toggle edit approval" }]}
		/>
	);
}
