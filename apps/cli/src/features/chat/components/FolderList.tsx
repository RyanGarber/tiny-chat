import { useChatList } from "@tiny-chat/client/src/features/chat/hooks/useChatList.ts";
import { ChatService } from "@tiny-chat/client/src/features/chat/services/ChatService.ts";
import { usePage } from "../../../core/hooks/usePage.ts";
import { useWorkingStatus } from "../../../core/hooks/useWorkingStatus.ts";
import Completions from "../../editor/components/Completions.tsx";

export default function FolderList() {
	const { folders } = useChatList();
	useWorkingStatus(folders);
	const { setPage } = usePage();
	const items = folders.data?.pages.flatMap((page) => page.folders) ?? [];
	return (
		<Completions
			groups={[
				{
					items: [
						{ name: "No folder", value: "" },
						...items.map((folder) => ({
							name: folder.title || "Untitled",
							value: folder.id,
						})),
					],
				},
			]}
			onInput={({ item, key }) => {
				if (!key.return || !item) return;
				ChatService.newChat(
					items.find((folder) => folder.id === item.value) ?? null,
				);
				setPage("chat");
			}}
			actions={["back"]}
		/>
	);
}
