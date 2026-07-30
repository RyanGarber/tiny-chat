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
import { DataUtils } from "@tiny-chat/shared/src/features/data/utils/DataUtils.ts";
import { search_web } from "@tiny-chat/shared/src/features/tool/tools/web/search_web.ts";
import { view_web } from "@tiny-chat/shared/src/features/tool/tools/web/view_web.ts";
import { ToolUtils } from "@tiny-chat/shared/src/features/tool/utils/ToolUtils.ts";
import { MediaPlayer, MediaProvider } from "@vidstack/react";
import {
	DefaultAudioLayout,
	DefaultVideoLayout,
	defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";
import { type CSSProperties, memo, type ReactNode, useMemo } from "react";
import type { z } from "zod";
import { Code } from "#frontend/core/components/Components.tsx";
import { useActions } from "#frontend/features/chat/hooks/useActions.ts";
import { useChat } from "#frontend/features/chat/hooks/useChat.ts";
import { useMemories } from "#frontend/features/chat/hooks/useMemories.ts";
import { InputService } from "#frontend/features/chat/services/InputService.ts";
import { useProviders } from "#frontend/features/config/hooks/useProviders.ts";
import { useTools } from "#frontend/features/config/hooks/useTools.ts";
import { useFilesystem } from "#frontend/features/file/hooks/useFilesystem.ts";
import { useSkills } from "#frontend/features/file/hooks/useSkills.ts";
import { Markdown } from "#frontend/features/message/components/Markdown.tsx";
import { ToolCallInput } from "#frontend/features/message/components/ToolCallInput.tsx";
import { useMessageSelection } from "#frontend/features/message/hooks/useMessageSelection.ts";
import { useMessages } from "#frontend/features/message/hooks/useMessages.ts";
import { useMessageStream } from "#frontend/features/message/hooks/useStreaming.ts";
import { MessageHandlerService } from "#frontend/features/message/services/MessageHandlerService.ts";
import { useThemes } from "#frontend/features/settings/hooks/useThemes.ts";
import { auth } from "#frontend/utils/api.ts";
import { SHADOW } from "#frontend/utils/style.ts";
import {
	Author,
	type MessageState,
	type zDataPart,
} from "#shared/features/data/types/message";
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
		const session = auth.useSession();
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
			if (text) InputService.insertQuote(message.config.model, text);
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

		const parts = live.data.flat();

		// Render parts
		const renderedParts: ReactNode[] = [];
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];

			if (part.type === "thought") {
				const groupedThoughts = [part.value];
				let end = i;
				while (end + 1 < parts.length) {
					const nextPart = parts[end + 1];
					if (nextPart.type !== "thought") break;
					groupedThoughts.push(nextPart.value);
					end++;
				}

				const isThinkingActive =
					live.state.thinking && end === parts.length - 1;
				renderedParts.push(
					<Thinking
						key={`thought-${i}`}
						thoughts={groupedThoughts}
						isThinking={isThinkingActive}
						context={{
							webReferences: webContext,
							memoryReferences: memories.data ?? [],
							actionReferences: actions.data ?? [],
							fileReferences: chatFiles.data ?? [],
							isGenerating: isGenerating,
						}}
					/>,
				);

				i = end;
			} else if (part.type === "toolCall") {
				const result = parts.find(
					(p): p is Extract<zDataPart, { type: "toolResult" }> =>
						p.type === "toolResult" && p.id === part.id,
				);

				renderedParts.push(
					<ToolCall key={i} toolCall={part} toolResult={result} />,
				);

				const { tool } = ToolUtils.find({ toolsets, name: part.name });
				if (tool?.feedback || tool?.approval) {
					renderedParts.push(
						<ToolCallInput
							key={`${i}-tci`}
							message={message}
							toolCall={part}
							toolResult={result}
							containerWidth={containerWidth}
							tool={tool}
						/>,
					);
				}
			} else if (part.type === "text") {
				if (part.value.trim().length) {
					renderedParts.push(
						<Markdown
							key={i}
							source={part.value}
							context={{
								webReferences: webContext,
								memoryReferences: memories.data ?? [],
								actionReferences: actions.data ?? [],
								fileReferences: chatFiles.data ?? [],
								isGenerating: isGenerating,
							}}
						/>,
					);
				}
			} else if (part.type === "json") {
				renderedParts.push(
					<Code language="json" code={JSON.stringify(part.value, null, 4)} />,
				);
			} else if (part.type === "file") {
				if (part.mime?.startsWith("image/")) {
					renderedParts.push(
						<Image
							key={i}
							src={`data:${part.mime};base64,${part.data}`}
							alt={part.name}
							radius="md"
							maw="100%"
							w="auto"
							my={4}
						/>,
					);
				} else if (
					part.mime?.startsWith("audio/") ||
					part.mime?.startsWith("video/")
				) {
					renderedParts.push(
						<MediaPlayer
							key={i}
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
						</MediaPlayer>,
					);
				}
			} else if (part.type === "abort") {
				renderedParts.push(
					<Alert
						mb={10}
						key={i}
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
									void MessageHandlerService.handle({
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
					</Alert>,
				);
			}
		}

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
										void MessageHandlerService.handle({
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
					{renderedParts}
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
									boxShadow: SHADOW,
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
