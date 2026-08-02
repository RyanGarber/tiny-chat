import { useGreeting } from "@tiny-chat/client/src/core/hooks/useGreeting.ts";
import { useChatStore } from "@tiny-chat/client/src/features/chat/stores/useChatStore.ts";
import { Box, Text, useInput, useWindowSize } from "ink";
import Spinner from "ink-spinner";
import Chat from "../../features/chat/components/Chat.tsx";
import ChatList from "../../features/chat/components/ChatList.tsx";
import ModelList from "../../features/config/components/ModelList.tsx";
import Input from "../../features/input/components/Input.tsx";
import { useAppStore } from "../stores/useAppStore.ts";

export default function App() {
	const { rows } = useWindowSize();

	const page = useAppStore((state) => state.page);
	const setPage = useAppStore((state) => state.setPage);
	const statuses = useAppStore((state) => state.statuses);

	const chatId = useChatStore((state) => state.chatId);
	const greeting = useGreeting();

	useInput((_, key) => {
		if (key.escape && page !== "chat") {
			setPage("chat");
		}
	});

	return (
		<Box flexDirection="column" height={rows}>
			{page === "chat-list" && <ChatList />}
			{page === "model-list" && <ModelList />}
			{page === "chat" &&
				(chatId ? (
					<Chat />
				) : (
					<Box flexGrow={1} justifyContent="center" alignItems="center">
						<Text>{greeting}</Text>
					</Box>
				))}
			{statuses.map((status) => (
				<Box key={status.id}>
					<Spinner type="bluePulse" />
					<Text>{status.text ?? "Working..."}</Text>
				</Box>
			))}
			{page === "chat" && <Input />}
		</Box>
	);
}
