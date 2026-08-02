import { useChatList } from "@tiny-chat/client/src/features/chat/hooks/useChatList.ts";
import { ChatService } from "@tiny-chat/client/src/features/chat/services/ChatService.ts";
import { Box, Text, useInput, useWindowSize } from "ink";
import { ScrollList } from "ink-scroll-list";
import { useMemo, useState } from "react";
import { useLoadingStatus } from "../../../core/hooks/useLoadingStatus.ts";
import { useAppStore } from "../../../core/stores/useAppStore.ts";

export default function ChatList() {
	const { rows } = useWindowSize();

	const { folders } = useChatList();
	useLoadingStatus(folders);

	const setPage = useAppStore((state) => state.setPage);

	const { folderList, chatList } = useMemo(() => {
		const folderList =
			folders.data?.pages.flatMap((page) => page.folders) ?? [];
		const chatList = folderList.flatMap((folder) => folder.chats);
		return { folderList, chatList };
	}, [folders.data]);

	const [selected, setSelected] = useState(0);

	useInput((_, key) => {
		if (key.upArrow) {
			setSelected((previous) => Math.max(previous - 1, 0));
		}
		if (key.downArrow) {
			setSelected((previous) => Math.min(previous + 1, chatList.length - 1));
		}
		if (key.return) {
			ChatService.setChat(chatList[selected]);
			setPage("chat");
		}
	});

	return (
		<ScrollList
			selectedIndex={selected}
			height={rows - 2}
			borderColor="blueBright"
			borderStyle="round"
		>
			{chatList.map((chat) => {
				const folder = folderList.find((folder) => folder.chats.includes(chat));
				const isFirstChat = folder && folder.chats.indexOf(chat) === 0;
				return (
					<Box key={chat.id} flexDirection="column">
						{isFirstChat && folder.chats.length > 1 && (
							<Text color="gray">--- {folder?.title} ---</Text>
						)}
						<Text
							color={selected === chatList.indexOf(chat) ? "blue" : "white"}
						>
							{selected === chatList.indexOf(chat) ? "▶ " : "  "}
							{chat.title}
						</Text>
					</Box>
				);
			})}
		</ScrollList>
	);
}
