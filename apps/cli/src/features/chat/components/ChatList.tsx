import { Box, Text, useInput, useWindowSize } from "ink";
import { ScrollList } from "ink-scroll-list";
import { useMemo, useState } from "react";
import { useAppStore } from "../../../core/stores/useAppStore.ts";
import { useChatList } from "../hooks/useChatList.ts";

export default function ChatList() {
	const { folders, setChat } = useChatList();
	const { rows } = useWindowSize();

	const chats = useMemo(() => {
		return folders.data?.pages.flat().flatMap((page) => page.folders) ?? [];
	}, [folders.data]);

	const setPage = useAppStore((state) => state.setPage);

	const [selected, setSelected] = useState(0);

	useInput((_, key) => {
		if (key.upArrow) {
			setSelected((previous) => Math.max(previous - 1, 0));
		}
		if (key.downArrow) {
			setSelected((previous) => Math.min(previous + 1, chats.length - 1));
		}
		if (key.return) {
			setChat.mutate(chats[selected].id);
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
			{chats.map((chat, index) => (
				<Box key={chat.id}>
					<Text color={selected === index ? "blue" : "white"}>
						{selected === index ? "▶ " : "  "}
						{chat.title}
					</Text>
				</Box>
			))}
		</ScrollList>
	);
}
