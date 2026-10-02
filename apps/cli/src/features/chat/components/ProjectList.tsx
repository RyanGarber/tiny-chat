import { useChatList } from "@tiny-chat/client/features/chat/hooks/useChatList.ts";
import { ChatService } from "@tiny-chat/client/features/chat/services/ChatService.ts";
import { useState } from "react";
import { usePage } from "../../../core/hooks/usePage.ts";
import { useWorkingStatus } from "../../../core/hooks/useWorkingStatus.ts";
import Completions from "../../editor/components/Completions.tsx";
import ProjectEditor from "./ProjectEditor.tsx";

export default function ProjectList() {
	const { projects } = useChatList();
	useWorkingStatus(projects);
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
			actions={["select", { key: "e", name: "edit" }, "back"]}
		/>
	);
}
