import { useChatList } from "@tiny-chat/client/src/features/chat/hooks/useChatList.ts";
import { ChatService } from "@tiny-chat/client/src/features/chat/services/ChatService.ts";
import type { ChatState } from "@tiny-chat/core/src/features/data/types/chat.ts";
import type { ScrollListRef } from "ink-scroll-list";
import { useRef, useState } from "react";
import { useSentinel } from "../../../core/hooks/useSentinel.ts";
import { useWorkingStatus } from "../../../core/hooks/useWorkingStatus.ts";
import { useAppStore } from "../../../core/stores/useAppStore.ts";
import Completions from "../../editor/components/Completions.tsx";

export default function ChatList() {
	const { folders, deleteChat } = useChatList();
	useWorkingStatus(folders, deleteChat);

	const folderList = folders.data?.pages.flatMap((page) => page.folders) ?? [];

	const scrollRef = useRef<ScrollListRef>(null);

	const { onScroll, onContentHeightChange, onViewportSizeChange } = useSentinel(
		{
			scrollRef,
			query: folders,
			edge: "bottom",
		},
	);

	const setPage = useAppStore((state) => state.setPage);

	const [selected, setSelected] = useState<ChatState | null>(null);

	if (selected) {
		return (
			<Completions
				groups={[
					{
						name: selected.title ?? "",
						items: [{ name: "Delete", value: "delete" }],
					},
				]}
				onInput={({ item, input, key }) => {
					if (key.escape || key.backspace || input === " ") {
						setSelected(null);
					}
					if (key.return && item) {
						if (item.value === "delete") {
							deleteChat.mutate({ chat: selected });
							setSelected(null);
						}
					}
				}}
				actions={["back"]}
			/>
		);
	}

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
				if (input === " " && item) {
					setSelected(
						folderList
							.flatMap((folder) => folder.chats)
							.find((chat) => chat.id === item.value) ?? null,
					);
				}
				if (key.escape || key.backspace) {
					if (selected) {
						setSelected(null);
					} else {
						setPage("chat");
					}
				}
			}}
			actions={[{ key: "space", name: "options" }]}
			selectFirstOnChange={false}
			ref={scrollRef}
			onScroll={onScroll}
			onContentHeightChange={onContentHeightChange}
			onViewportSizeChange={onViewportSizeChange}
		/>
	);
}
