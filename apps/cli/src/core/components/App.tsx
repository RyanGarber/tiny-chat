import { useGreeting } from "@tiny-chat/client/src/core/hooks/useGreeting.ts";
import { useChatStore } from "@tiny-chat/client/src/features/chat/stores/useChatStore.ts";
import { Box, Text, useWindowSize } from "ink";
import Spinner from "ink-spinner";
import CapabilitySelect from "../../features/agent/components/CapabilitySelect.tsx";
import Chat from "../../features/chat/components/Chat.tsx";
import ChatList from "../../features/chat/components/ChatList.tsx";
import Input from "../../features/editor/components/Input.tsx";
import ToolCallInput from "../../features/message/components/ToolCallInput.tsx";
import { useToolCallQueue } from "../../features/message/hooks/useToolCallQueue.ts";
import { useAppStore } from "../stores/useAppStore.ts";

export default function App() {
	const { rows } = useWindowSize();

	const page = useAppStore((state) => state.page);
	const statuses = useAppStore((state) => state.statuses);

	const chatId = useChatStore((state) => state.chatId);
	const greeting = useGreeting();

	const { toolCall } = useToolCallQueue();

	return (
		<Box flexDirection="column" height={rows}>
			{chatId ? (
				<Chat />
			) : (
				<Box flexGrow={1} justifyContent="center" alignItems="center">
					<Text>{greeting}</Text>
				</Box>
			)}
			{statuses.map((status) => (
				<Box key={status.id}>
					<Spinner type="bluePulse" />
					<Text>{status.text ?? "Working..."}</Text>
				</Box>
			))}
			{page === "chat" && toolCall && (
				<ToolCallInput
					key={toolCall.toolCall.id}
					message={toolCall.message}
					toolCall={toolCall.toolCall}
				/>
			)}
			{page === "chats" && <ChatList />}
			{(page === "tools" || page === "skills") && <CapabilitySelect />}
			<Input disabled={page !== "chat" || !!toolCall || !!statuses.length} />
		</Box>
	);
}
