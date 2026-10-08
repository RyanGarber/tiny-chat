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
	const {
		folders,
		folderStatus,
		primaryFolder,
		addFolder,
		removeFolder,
		updateFolder,
		moveFolder,
	} = useShellSettings({ project });
	useWorkingStatus(addFolder, updateFolder, removeFolder, moveFolder);

	const toggle = (index: number) =>
		updateFolder.mutate({
			project,
			index,
			folder: { whitelist: !folders[index].whitelist },
		});

	return (
		<TextList
			entries={folders.map(({ path, whitelist }) => ({
				text: path,
				detail: [
					path === primaryFolder ? "primary on this device" : undefined,
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
			onEdit={(index, path) =>
				updateFolder.mutate({ project, index, folder: { path } })
			}
			// Enter toggles edit approval, so the path is written with `e`.
			onSelect={toggle}
			selectName="toggle"
			onRemove={(index) => removeFolder.mutate({ project, index })}
			bindings={{
				toggle: { run: toggle },
				reorder: {
					run: (index, direction) => {
						const to = index + direction;
						if (to < 0 || to >= folders.length) return;
						moveFolder.mutate({ project, index, to });
					},
				},
			}}
		/>
	);
}
