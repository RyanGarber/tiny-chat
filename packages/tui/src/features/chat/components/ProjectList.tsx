import { useState } from "react";
import { useChatList } from "#client/features/chat/hooks/useChatList.ts";
import { ChatService } from "#client/features/chat/services/ChatService.ts";
import { usePage } from "#tui/core/hooks/usePage.ts";
import { useWorkingStatus } from "#tui/core/hooks/useWorkingStatus.ts";
import ProjectEditor from "#tui/features/chat/components/ProjectEditor.tsx";
import Completions from "#tui/features/editor/components/Completions.tsx";

export default function ProjectList() {
	const { projects, createProject } = useChatList();
	useWorkingStatus(projects, createProject);
	const items = projects.data?.pages.flatMap((page) => page.projects) ?? [];

	// Looked up afresh so the editor shows a rename as soon as it lands.
	const [editingId, setEditingId] = useState<string | null>(null);
	const editing = items.find((project) => project.id === editingId);

	// The editor takes `back` while it is open, closing itself last.
	const { setPage } = usePage({
		onBack: () => (editing ? false : undefined),
	});

	if (editing) {
		return (
			<ProjectEditor project={editing} onClose={() => setEditingId(null)} />
		);
	}

	return (
		<Completions
			groups={[
				{
					items: [
						{ name: "(none)", value: "" },
						...items.map((project) => ({
							name: project.title || "Untitled",
							value: project.id,
						})),
					],
				},
			]}
			onInput={({ item, input, key }) => {
				// A new project opens in its editor, where it is named.
				if (input === "n") {
					createProject.mutate(undefined, {
						onSuccess: (project) => setEditingId(project.id),
					});
					return true;
				}
				if (!item) return;
				if (input === "e" && item.value) {
					setEditingId(item.value);
					return true;
				}
				if (!key.return) return;
				ChatService.newChat(
					items.find((project) => project.id === item.value) ?? null,
				);
				setPage("chat");
			}}
			actions={[
				"select",
				{ key: "e", name: "edit" },
				{ key: "n", name: "new project" },
				"back",
			]}
		/>
	);
}
