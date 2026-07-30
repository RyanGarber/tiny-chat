import { GreetingUtils } from "@tiny-chat/core/src/features/ui/utils/GreetingUtils.ts";
import { Box, Text, useInput, useWindowSize } from "ink";
import { useMemo } from "react";
import Chat from "../../features/chat/components/Chat.tsx";
import ChatList from "../../features/chat/components/ChatList.tsx";
import { useChatStore } from "../../features/chat/stores/useChatStore.ts";
import Input from "../../features/input/components/Input.tsx";
import { useSession } from "../hooks/useSession.ts";
import { useAppStore } from "../stores/useAppStore.ts";
import Status from "./Status.tsx";

export default function App() {
	const { rows } = useWindowSize();
	const { session } = useSession();

	const page = useAppStore((state) => state.page);
	const setPage = useAppStore((state) => state.setPage);
	const chatId = useChatStore((state) => state.chatId);

	const greeting = useMemo(() => {
		return GreetingUtils.get({ name: session.data?.user?.name.split(" ")[0] });
	}, [session.data]);

	useInput((_, key) => {
		if (key.escape && page !== "chat") {
			setPage("chat");
		}
	});

	return (
		<Box flexDirection="column" height={rows}>
			{page === "chat-list" && <ChatList />}
			{page === "chat" &&
				(chatId ? (
					<Chat />
				) : (
					<Box flexGrow={1} justifyContent="center" alignItems="center">
						<Text>{greeting}</Text>
					</Box>
				))}
			<Status />
			{page === "chat" && <Input />}
		</Box>
	);
}
