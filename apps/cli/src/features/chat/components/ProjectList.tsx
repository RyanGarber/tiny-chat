import { useChatList } from "@tiny-chat/client/features/chat/hooks/useChatList.ts";
import { ChatService } from "@tiny-chat/client/features/chat/services/ChatService.ts";
import { usePage } from "../../../core/hooks/usePage.ts";
import { useWorkingStatus } from "../../../core/hooks/useWorkingStatus.ts";
import Completions from "../../editor/components/Completions.tsx";

export default function ProjectList() {
	const { projects } = useChatList();
	useWorkingStatus(projects);
	const { setPage } = usePage();
	const items = projects.data?.pages.flatMap((page) => page.projects) ?? [];
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
			onInput={({ item, key }) => {
				if (!key.return || !item) return;
				ChatService.newChat(
					items.find((project) => project.id === item.value) ?? null,
				);
				setPage("chat");
			}}
			actions={["select", "back"]}
		/>
	);
}
