import { useChatList } from "@tiny-chat/client/src/features/chat/hooks/useChatList.ts";
import { ChatService } from "@tiny-chat/client/src/features/chat/services/ChatService.ts";
import { usePage } from "../../../core/hooks/usePage.ts";
import { useSentinel } from "../../../core/hooks/useSentinel.ts";
import { useWorkingStatus } from "../../../core/hooks/useWorkingStatus.ts";
import Completions from "../../editor/components/Completions.tsx";

export default function ChatList() {
	const { folders, deleteChat } = useChatList();
	useWorkingStatus(folders, deleteChat);

	const folderList = folders.data?.pages.flatMap((page) => page.folders) ?? [];

	// Older chats are appended below the list, so reaching the bottom is what
	// asks for the next page.
	const fetchOlder = useSentinel(folders);

	const { setPage } = usePage();

	return (
		<Completions
			groups={folderList.map((folder) => ({
				name: folder.chats.length > 1 ? (folder.title ?? "") : undefined,
				items: folder.chats.map((chat) => ({
					name: chat.title ?? "",
					value: chat.id,
				})),
			}))}
			onInput={({ item, input, key }) => {
				if (key.return && item) {
					ChatService.setChat({ id: item.value });
					setPage("chat");
				}
				if (input === "d" && item) {
					const chat = folderList
						.flatMap((folder) => folder.chats)
						.find((chat) => chat.id === item.value);
					if (!chat) return;
					deleteChat.mutate({ chat });
				}
			}}
			renderEmpty={() => "nothing here yet"}
			actions={[{ key: "d", name: "delete" }, "back"]}
			selectFirstOnChange={false}
			onReachBottom={fetchOlder}
		/>
	);
}
