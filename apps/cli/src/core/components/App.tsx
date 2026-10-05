import { ThemeContext } from "@tiny-chat/client/core/components/ThemeContext.tsx";
import { usePrepareCode } from "@tiny-chat/client/core/hooks/useCode.ts";
import { useChatList } from "@tiny-chat/client/features/chat/hooks/useChatList.ts";
import { useDefaultProject } from "@tiny-chat/client/features/chat/hooks/useDefaultProject.ts";
import { ChatService } from "@tiny-chat/client/features/chat/services/ChatService.ts";
import { useDraftStore } from "@tiny-chat/client/features/chat/stores/useDraftStore.ts";
import { useEstimatedTokens } from "@tiny-chat/client/features/editor/hooks/useEstimatedTokens.ts";
import { MessageProvider } from "@tiny-chat/client/features/message/components/MessageProvider.tsx";
import { Box, useInput, useWindowSize } from "ink";
import { type ReactNode, useContext, useEffect } from "react";
import ChatConfig from "../../features/agent/components/ChatConfig.tsx";
import Chat from "../../features/chat/components/Chat.tsx";
import ChatEffects from "../../features/chat/components/ChatEffects.tsx";
import ChatFiles from "../../features/chat/components/ChatFiles.tsx";
import ChatList from "../../features/chat/components/ChatList.tsx";
import ProjectList from "../../features/chat/components/ProjectList.tsx";
import Editor from "../../features/editor/components/Editor.tsx";
import { CitationCard } from "../../features/message/components/Citation.tsx";
import Settings from "../../features/settings/components/Settings.tsx";
import { useUpdate } from "../../features/update/hooks/useUpdate.ts";
import GitHub from "../../features/upload/components/GitHub.tsx";
import Uploads from "../../features/upload/components/Uploads.tsx";
import type { Color } from "../hooks/useColor.ts";
import { WidthContext } from "../hooks/useWidth.ts";
import {
	type Panel as PanelName,
	selectFocus,
	selectPage,
	useAppStore,
} from "../stores/useAppStore.ts";
import Panel from "./Panel.tsx";
import StatusText from "./StatusText.tsx";

/** Columns from which the chat list and files open beside the chat rather than below it. */
const SIDEBAR_COLUMNS = 120;
// Halfway between the former chat-list (32) and file-preview (up to 64) widths.
const panelWidth = (columns: number) =>
	Math.floor((32 + Math.min(64, Math.floor(columns * 0.4))) / 2);

export default function App() {
	const { colorScheme } = useContext(ThemeContext);
	usePrepareCode();
	useDefaultProject();

	const { rows, columns } = useWindowSize();

	const page = useAppStore(selectPage);
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
			// Pages, panels and tool controls own their keys (a tool control
			// cycles its suggestions with it): the shortcut is the editor's.
			if (selectFocus(useAppStore.getState()) !== "editor") return;
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

	const panels = useAppStore((state) => state.panels);
	const closePanel = useAppStore((state) => state.closePanel);
	const sidebars = columns >= SIDEBAR_COLUMNS;
	const left = sidebars && panels.chats ? panelWidth(columns) : 0;
	const right = sidebars && panels.files ? panelWidth(columns) : 0;
	const width = columns - left - right;
	const panelCount = Number(panels.chats) + Number(panels.files);
	const bottomWidth = Math.floor(columns / Math.max(1, panelCount));

	const panel = (name: PanelName, children: ReactNode) => (
		<Panel
			id={name}
			title={name}
			closable
			onClose={() => closePanel(name)}
			flexGrow={1}
			minHeight={0}
			padding={1}
			backgroundColor="interior"
		>
			{children}
		</Panel>
	);

	return (
		<MessageProvider>
			<Box
				flexDirection="row"
				height={rows}
				backgroundColor={colorScheme.exterior}
			>
				{left > 0 && (
					<Box width={left} flexShrink={0} flexDirection="column">
						{panel("chats", <ChatList fill />)}
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
							{!sidebars && panelCount > 0 && (
								<Box height={Math.floor(rows / 2)} flexShrink={0}>
									{panels.chats && (
										<Box width={bottomWidth} flexDirection="column">
											{panel("chats", <ChatList fill />)}
										</Box>
									)}
									{panels.files && (
										<Box width={bottomWidth} flexDirection="column">
											{panel(
												"files",
												<ChatFiles fill width={bottomWidth - 2} />,
											)}
										</Box>
									)}
								</Box>
							)}
							{page === "projects" && <ProjectList />}
							{page === "uploads" && <Uploads />}
							{page === "github" && <GitHub />}
							{page === "settings" && <Settings />}
							{page === "config" && <ChatConfig />}
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
						{panel("files", <ChatFiles fill width={right - 2} />)}
					</Box>
				)}
				<CitationCard />
			</Box>
		</MessageProvider>
	);
}
