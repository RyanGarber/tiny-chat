import { Icon } from "@iconify/react";
import {
	ActionIcon,
	Alert,
	Box,
	Button,
	Group,
	Image,
	Portal,
	Stack,
	Text,
	Transition,
} from "@mantine/core";
import { useProviders } from "@tiny-chat/client/src/features/agent/hooks/useProviders.ts";
import { useTools } from "@tiny-chat/client/src/features/agent/hooks/useTools.ts";
import { AgentMessageService } from "@tiny-chat/client/src/features/agent/services/AgentMessageService.ts";
import { useChat } from "@tiny-chat/client/src/features/chat/hooks/useChat.ts";
import { useMessages } from "@tiny-chat/client/src/features/chat/hooks/useMessages.ts";
import { useMessageStream } from "@tiny-chat/client/src/features/chat/hooks/useStreaming.ts";
import { useThemes } from "@tiny-chat/client/src/features/settings/hooks/useThemes.ts";
import { useActions } from "@tiny-chat/client/src/features/user/hooks/useActions.ts";
import { useMemories } from "@tiny-chat/client/src/features/user/hooks/useMemories.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { search_web } from "@tiny-chat/core/src/features/tool/tools/web/search_web.ts";
import { view_web } from "@tiny-chat/core/src/features/tool/tools/web/view_web.ts";
import { ToolUtils } from "@tiny-chat/core/src/features/tool/utils/ToolUtils.ts";
import { MediaPlayer, MediaProvider } from "@vidstack/react";
import {
	DefaultAudioLayout,
	DefaultVideoLayout,
	defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";
import { type CSSProperties, memo, useMemo } from "react";
import type { z } from "zod";
import { useSession } from "#client/src/core/hooks/useSession.ts";
import { useSkills } from "#client/src/features/agent/hooks/useSkills.ts";
import {
	Author,
	type MessageState,
	type zDataPart,
} from "#core/features/data/types/message";
import { client } from "#ui/client.ts";
import { Code } from "#ui/core/components/Components.tsx";
import { StyleUtils } from "#ui/core/utils/StyleUtils.ts";
import { EditorUtils } from "#ui/features/editor/utils/EditorUtils.ts";
import { Markdown } from "#ui/features/message/components/Markdown.tsx";
import { ToolCallInput } from "#ui/features/message/components/ToolCallInput.tsx";
import { useMessageSelection } from "#ui/features/message/hooks/useMessageSelection.ts";
import { useFilesystem } from "#ui/features/upload/hooks/useFilesystem.ts";
import { Thinking } from "./Thinking";
import { ToolCall } from "./ToolCall";

export const MessageBodyContent = memo(
	({
		message,
		containerWidth,
		style,
	}: {
		message: MessageState;
		containerWidth: number;
		style?: CSSProperties;
	}) => {
		const { session } = useSession();
		const { chat } = useChat();
		const { theme } = useThemes();
		const { toolsets, mcpTools } = useTools();
		const { skills } = useSkills();
		const { memories } = useMemories();
		const { actions } = useActions();
		const { providers } = useProviders();
		const { messages } = useMessages();
		const { chatFiles } = useFilesystem();

		const messageList = useMemo(
			() => messages.data?.pages.flatMap((m) => m.messages) ?? [],
			[messages.data],
		);

		const stream = useMessageStream(
			message.author === Author.MODEL ? message.id : undefined,
		);
		const live = stream ?? message;
		const isGenerating = live.state.generating;

		const { rect, captureSelection, getSelectedText } = useMessageSelection(
			message.id,
		);

		const isSelected = rect !== null;

		const handleQuoteClick = () => {
			const text = getSelectedText();
			if (text) EditorUtils.insertQuote(message.config.model, text);
		};

		const webContext = useMemo(
			() =>
				messageList.flatMap((m) =>
					m.data
						.flat()
						.filter(
							(p): p is Extract<zDataPart, { type: "toolResult" }> =>
								p.type === "toolResult" && !p.error,
						)
						.flatMap((p) => {
							if (p.name === search_web.name && p.value[0]?.type === "json") {
								return p.value[0].value as z.infer<typeof search_web.output>;
							} else if (
								p.name === view_web.name &&
								p.value[0]?.type === "json"
							) {
								return p.value[0].value as z.infer<typeof view_web.output>;
							}
							return [];
						}),
				),
			[messageList],
		);

		if (message.author === Author.USER) {
			return (
				<Box className="selectable">
					<Markdown
						source={DataUtils.getText({
							data: message.data,
							join: "\n",
						})}
						boxProps={{ style: { maxWidth: containerWidth - 40 } }}
					/>
				</Box>
			);
		}

		const parts = DataUtils.getRenderedPartsGrouped(live, "thought");

		// Stale message check: if a prior model message has a newer createdAt than this message
		const isStale =
			!live.state.any &&
			messageList.some(
				(m) =>
					m.author === Author.MODEL &&
					messageList.indexOf(m) < messageList.indexOf(message) &&
					new Date(m.createdAt).getTime() >
						new Date(message.createdAt).getTime(),
			);

		return (
			<>
				<Box
					w="100%"
					data-message-id={message.id}
					display="inline"
					className="selectable"
					style={style}
				>
					{isStale && (
						<Alert variant="light" mb="lg">
							<Group justify="space-between">
								<Group>
									<Icon icon="lucide:alert-circle" />
									<Text>Edits in the chat may change this response</Text>
								</Group>
								<ActionIcon
									variant="subtle"
									onClick={() =>
										session.data &&
										chat.data &&
										providers.data &&
										void AgentMessageService.handle({
											client,
											user: session.data.user,
											message,
											chat: chat.data,
											mcpTools: mcpTools.data,
											skills,
											providers: providers.data,
										})
									}
								>
									<Icon icon="lucide:refresh-cw" />
								</ActionIcon>
							</Group>
						</Alert>
					)}
					{/* biome-ignore-start lint/suspicious/noArrayIndexKey: parts stay in order */}
					{parts.map((part, index) => {
						if (part.type === "group") {
							return (
								<Thinking
									key={index}
									thoughts={part.value.map((thought) => thought.value)}
									isThinking={part.value.some((thought) => thought.active)}
									context={{
										webReferences: webContext,
										memoryReferences: memories.data ?? [],
										actionReferences: actions.data ?? [],
										fileReferences: chatFiles.data ?? [],
										isGenerating: isGenerating,
									}}
								/>
							);
						} else if (part.type === "toolCall") {
							const { tool } = ToolUtils.find({ toolsets, name: part.name });
							return (
								<div key={index}>
									<ToolCall toolCall={part} toolResult={part.result} />
									{(tool?.feedback || tool?.approval) && (
										<ToolCallInput
											message={message}
											toolCall={part}
											toolResult={part.result}
											containerWidth={containerWidth}
											tool={tool}
										/>
									)}
								</div>
							);
						} else if (part.type === "text") {
							return (
								<Markdown
									key={index}
									source={part.value}
									context={{
										webReferences: webContext,
										memoryReferences: memories.data ?? [],
										actionReferences: actions.data ?? [],
										fileReferences: chatFiles.data ?? [],
										isGenerating: isGenerating,
									}}
								/>
							);
						} else if (part.type === "json") {
							return (
								<Code
									key={index}
									language="json"
									code={JSON.stringify(part.value, null, 4)}
								/>
							);
						} else if (part.type === "file") {
							if (part.mime.startsWith("image/")) {
								return (
									<Image
										key={index}
										src={`data:${part.mime};base64,${part.data}`}
										alt={part.name}
										radius="md"
										maw="100%"
										w="auto"
										my={4}
									/>
								);
							} else if (part.mime.startsWith("video/")) {
								return (
									<MediaPlayer
										key={index}
										title={part.name}
										src={`data:${part.mime};base64,${part.data}`}
										crossOrigin
										playsInline
									>
										<MediaProvider></MediaProvider>
										<DefaultAudioLayout
											icons={defaultLayoutIcons}
											colorScheme={theme.data}
										/>
										<DefaultVideoLayout
											icons={defaultLayoutIcons}
											colorScheme={theme.data}
										/>
									</MediaPlayer>
								);
							}
						} else if (part.type === "abort") {
							return (
								<Alert
									key={index}
									mb={10}
									color={part.reason === "error" ? "red" : "gray"}
									variant="light"
									title={part.reason === "error" ? "Failed" : "Stopped"}
								>
									<Stack align="flex-end">
										<Text fz="15px" w="100%">
											{part.message ?? `Response ended due to ${part.reason}.`}
										</Text>
										<Button
											variant="subtle"
											color="dimmed"
											onClick={() =>
												session.data &&
												chat.data &&
												providers.data &&
												void AgentMessageService.handle({
													client,
													user: session.data.user,
													message,
													chat: chat.data,
													mcpTools: mcpTools.data,
													skills,
													providers: providers.data,
												})
											}
											leftSection={<Icon icon="lucide:refresh-cw" />}
										>
											Retry
										</Button>
									</Stack>
								</Alert>
							);
						}
						return null;
					})}
					{/* biome-ignore-end lint/suspicious/noArrayIndexKey: parts stay in order */}
				</Box>
				<Portal target={document.body}>
					<Transition
						mounted={isSelected ?? false}
						transition="fade"
						duration={100}
						timingFunction="ease"
					>
						{(styles) => (
							<ActionIcon
								size={32}
								style={{
									position: "fixed",
									top: (rect?.top ?? 0) - 30,
									left: (rect?.left ?? 0) + (rect?.width ?? 0) / 2,
									transform: "translateX(-50%)",
									zIndex: "var(--mantine-zindex-app)",
									boxShadow: StyleUtils.shadow,
									...styles,
								}}
								onMouseDown={captureSelection}
								onTouchStart={captureSelection}
								onClick={handleQuoteClick}
							>
								<Icon icon="lucide:message-square-quote" height={16} />
							</ActionIcon>
						)}
					</Transition>
				</Portal>
			</>
		);
	},
);
