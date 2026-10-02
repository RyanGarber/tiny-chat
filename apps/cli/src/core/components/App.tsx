import { ThemeContext } from "@tiny-chat/client/core/components/ThemeContext.tsx";
import { usePrepareCode } from "@tiny-chat/client/core/hooks/useCode.ts";
import { useChatList } from "@tiny-chat/client/features/chat/hooks/useChatList.ts";
import { useDefaultProject } from "@tiny-chat/client/features/chat/hooks/useDefaultProject.ts";
import { ChatService } from "@tiny-chat/client/features/chat/services/ChatService.ts";
import { useDraftStore } from "@tiny-chat/client/features/chat/stores/useDraftStore.ts";
import { useEstimatedTokens } from "@tiny-chat/client/features/editor/hooks/useEstimatedTokens.ts";
import { MessageProvider } from "@tiny-chat/client/features/message/components/MessageProvider.tsx";
import { Box, useInput, useWindowSize } from "ink";
import { useContext, useEffect } from "react";
import Capabilities from "../../features/agent/components/Capabilities.tsx";
import Chat from "../../features/chat/components/Chat.tsx";
import ChatEffects from "../../features/chat/components/ChatEffects.tsx";
import ChatFiles from "../../features/chat/components/ChatFiles.tsx";
import ChatList from "../../features/chat/components/ChatList.tsx";
import ProjectList from "../../features/chat/components/ProjectList.tsx";
import Editor from "../../features/editor/components/Editor.tsx";
import { useEditorStore } from "../../features/editor/stores/useEditorStore.ts";
import { CitationCard } from "../../features/message/components/Citation.tsx";
import Settings from "../../features/settings/components/Settings.tsx";
import { useUpdate } from "../../features/update/hooks/useUpdate.ts";
import GitHub from "../../features/upload/components/GitHub.tsx";
import Uploads from "../../features/upload/components/Uploads.tsx";
import type { Color } from "../hooks/useColor.ts";
import { WidthContext } from "../hooks/useWidth.ts";
import { useAppStore } from "../stores/useAppStore.ts";
import StatusText from "./StatusText.tsx";

/** Columns from which the chat list and files open beside the chat rather than below it. */
const SIDEBAR_COLUMNS = 120;
const CHATS_WIDTH = 32;

export default function App() {
	const { colorScheme } = useContext(ThemeContext);
	usePrepareCode();
	useDefaultProject();

	const { rows, columns } = useWindowSize();

	const page = useAppStore((state) => state.page);
	const statuses = useAppStore((state) => state.statuses);
	const setStatus = useAppStore((state) => state.setStatus);
	const unsetStatus = useAppStore((state) => state.unsetStatus);

	// A release is only announced, never taken on its own: it is the /update
	// command that replaces the binary this is running from.
	const { update } = useUpdate();

	useEffect(() => {
		if (!update.data) return;
		// biome-ignore lint/nursery/useReactCompiler: this effect synchronizes query data to the external app status store.
		setStatus({
			id: "update",
			text: `v${update.data} available - /update`,
			passive: true,
		});
	}, [update.data, setStatus]);

	const { projects } = useChatList();
	const projectList = projects.data?.pages.flatMap((page) => page.projects);

	useInput((input, key) => {
		if (key.shift && key.tab) {
			// A focused tool control uses shift+tab to cycle its own suggestions.
			if (useEditorStore.getState().focusedFeedbackId) return;
			// Pages own their keys; the shortcut only applies from the chat itself.
			if (page !== "chat") return;
			// Something written in the editor takes it to indent and unindent.
			if (!useDraftStore.getState().isEmpty) return;
			ChatService.cycleProject(projectList ?? []);
			return;
		}
		if (key.ctrl && (input === "c" || input === "d")) {
			if (statuses.find((status) => status.id === "quit")) {
				process.exit(0);
			} else {
				setStatus({ id: "quit", text: `enter ctrl+${input} again to quit` });
				setTimeout(() => unsetStatus({ id: "quit" }), 2000);
			}
		}
	});

	const draft = useDraftStore((state) => state.data);
	const { chatTokens, categories, usage } = useEstimatedTokens<Color>({
		draft,
		colors: { low: "primary", moderate: "yellowBright", high: "redBright" },
	});

	const sidebars = columns >= SIDEBAR_COLUMNS;
	const left = sidebars && page === "chats" ? CHATS_WIDTH : 0;
	const right =
		sidebars && page === "files" ? Math.min(64, Math.floor(columns * 0.4)) : 0;
	const width = columns - left - right;

	return (
		<MessageProvider>
			<Box
				flexDirection="row"
				height={rows}
				backgroundColor={colorScheme.exterior}
			>
				{left > 0 && (
					<Box width={left} flexShrink={0} flexDirection="column">
						<ChatList fill />
					</Box>
				)}
				<WidthContext.Provider value={width}>
					<Box
						flexDirection="column"
						width={width}
						flexShrink={0}
						minHeight={0}
					>
						<Chat compaction={chatTokens.data?.compaction} />
						<Box
							flexDirection="column"
							position="static"
							bottom={0}
							left={0}
							right={0}
						>
							<StatusText />
							{page === "chats" && !sidebars && <ChatList />}
							{page === "files" && !sidebars && <ChatFiles />}
							{page === "projects" && <ProjectList />}
							{page === "uploads" && <Uploads />}
							{page === "github" && <GitHub />}
							{page === "settings" && <Settings />}
							{(page === "tools" ||
								page === "skills" ||
								page === "browser" ||
								page === "subagents") && <Capabilities />}
							{page === "chat" && <ChatEffects />}
							<Editor
								disabled={
									page !== "chat" || statuses.some((status) => !status.passive)
								}
								usage={usage}
								categories={categories}
							/>
						</Box>
					</Box>
				</WidthContext.Provider>
				{right > 0 && (
					<Box width={right} flexShrink={0} flexDirection="column">
						<ChatFiles fill width={right - 2} />
					</Box>
				)}
				<CitationCard />
			</Box>
		</MessageProvider>
	);
}
