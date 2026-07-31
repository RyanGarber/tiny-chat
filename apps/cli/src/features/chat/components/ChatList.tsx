import { useChatList } from "@tiny-chat/react/src/features/chat/hooks/useChatList.ts";
import { ChatService } from "@tiny-chat/react/src/features/chat/services/ChatService.ts";
import { Box, Text, useInput, useWindowSize } from "ink";
import { ScrollList } from "ink-scroll-list";
import { useEffect, useMemo, useState } from "react";
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
			ChatService.setChatId(chatList[selected].id);
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
			{folderList.map((folder) => (
				<Box key={folder.id} borderLeft={true}>
					{folder.chats.map((chat) => (
						<Box key={chat.id}>
							<Text
								color={selected === chatList.indexOf(chat) ? "blue" : "white"}
							>
								{selected === chatList.indexOf(chat) ? "▶ " : "  "}
								{chat.title}
							</Text>
						</Box>
					))}
				</Box>
			))}
		</ScrollList>
	);
}
