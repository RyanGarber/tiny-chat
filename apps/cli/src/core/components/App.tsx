import { Box, useInput, useWindowSize } from "ink";
import CapabilitySelect from "../../features/agent/components/CapabilitySelect.tsx";
import Chat from "../../features/chat/components/Chat.tsx";
import ChatList from "../../features/chat/components/ChatList.tsx";
import Editor from "../../features/editor/components/Editor.tsx";
import { useAppStore } from "../stores/useAppStore.ts";
import StatusText from "./StatusText.tsx";

export default function App() {
	const { rows } = useWindowSize();

	const page = useAppStore((state) => state.page);
	const statuses = useAppStore((state) => state.statuses);
	const setStatus = useAppStore((state) => state.setStatus);
	const unsetStatus = useAppStore((state) => state.unsetStatus);

	useInput((input, key) => {
		if (key.ctrl && (input === "c" || input === "d")) {
			if (statuses.find((status) => status.id === "quit")) {
				process.exit(0);
			} else {
				setStatus({ id: "quit", text: `enter ctrl+${input} again to quit` });
				setTimeout(() => unsetStatus({ id: "quit" }), 2000);
			}
		}
	});

	return (
		// TODO - disabled={ ... && !!toolCallQueue.length }
		<Box flexDirection="column" height={rows}>
			<Chat />
			<StatusText />
			{page === "chats" && <ChatList />}
			{(page === "tools" || page === "skills") && <CapabilitySelect />}
			<Editor disabled={page !== "chat" || !!statuses.length} />
		</Box>
	);
}
