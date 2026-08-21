import { ThemeContext } from "@tiny-chat/client/src/core/components/ThemeContext.tsx";
import { Box, useInput, useWindowSize } from "ink";
import { useContext, useEffect } from "react";
import Capabilities from "../../features/agent/components/Capabilities.tsx";
import Chat from "../../features/chat/components/Chat.tsx";
import ChatList from "../../features/chat/components/ChatList.tsx";
import Editor from "../../features/editor/components/Editor.tsx";
import Settings from "../../features/settings/components/Settings.tsx";
import { useUpdate } from "../../features/update/hooks/useUpdate.ts";
import GitHub from "../../features/upload/components/GitHub.tsx";
import Uploads from "../../features/upload/components/Uploads.tsx";
import { useAppStore } from "../stores/useAppStore.ts";
import StatusText from "./StatusText.tsx";

export default function App() {
	const { colorScheme } = useContext(ThemeContext);

	const { rows } = useWindowSize();

	const page = useAppStore((state) => state.page);
	const statuses = useAppStore((state) => state.statuses);
	const setStatus = useAppStore((state) => state.setStatus);
	const unsetStatus = useAppStore((state) => state.unsetStatus);

	// A release is only announced, never taken on its own: it is the /update
	// command that replaces the binary this is running from.
	const { update } = useUpdate();

	useEffect(() => {
		if (!update.data) return;
		setStatus({
			id: "update",
			text: `v${update.data} available - /update`,
			passive: true,
		});
	}, [update.data, setStatus]);

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
		<Box
			flexDirection="column"
			height={rows}
			backgroundColor={colorScheme.exterior}
		>
			<Chat />
			<Box
				flexDirection="column"
				position="static"
				bottom={0}
				left={0}
				right={0}
			>
				<StatusText />
				{page === "chats" && <ChatList />}
				{page === "uploads" && <Uploads />}
				{page === "github" && <GitHub />}
				{page === "settings" && <Settings />}
				{(page === "tools" || page === "skills") && <Capabilities />}
				<Editor
					disabled={
						page !== "chat" || statuses.some((status) => !status.passive)
					}
				/>
			</Box>
		</Box>
	);
}
