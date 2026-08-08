import { Icon } from "@iconify/react";
import {
	ActionIcon,
	Alert,
	Box,
	type BoxProps,
	Button,
	Group,
	Image,
	Portal,
	Stack,
	Text,
	Transition,
} from "@mantine/core";
import type { MarkdownContext } from "@tiny-chat/client/src/features/message/components/MarkdownContext.tsx";
import { MessageContext } from "@tiny-chat/client/src/features/message/components/MessageContext.tsx";
import { useMessageStream } from "@tiny-chat/client/src/features/message/hooks/useMessageStream.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { ToolCallUtils } from "@tiny-chat/core/src/features/tool/utils/ToolCallUtils.ts";
import { MediaPlayer, MediaProvider } from "@vidstack/react";
import {
	DefaultAudioLayout,
	DefaultVideoLayout,
	defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";
import { memo, useContext, useMemo } from "react";
import { Code } from "#app/core/components/Components.tsx";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";
import { EditorUtils } from "#app/features/editor/utils/EditorUtils.ts";
import { Markdown } from "#app/features/message/components/Markdown.tsx";
import { ToolFeedback } from "#app/features/message/components/ToolFeedback.tsx";
import { useMessageSelection } from "#app/features/message/hooks/useMessageSelection.ts";
import { Author, type MessageState } from "#core/features/data/types/message";
import { Thought } from "./Thought.tsx";
import { ToolCall } from "./ToolCall";

const TEXT_SM: BoxProps["className"] = "text-[10px]";

export const MessageBodyContent = memo(
	({
		message,
		containerWidth,
	}: {
		message: MessageState;
		containerWidth: number;
	}) => {
		const { sources, toolsets, staleIds, nextFeedbackId, theme, retry } =
			useContext(MessageContext);

		const stream = useMessageStream(
			message.author === Author.MODEL ? message.id : undefined,
		);
		const live = stream ?? message;

		const { rect, captureSelection, getSelectedText } = useMessageSelection(
			message.id,
		);

		const isSelected = rect !== null;

		const handleQuoteClick = () => {
			const text = getSelectedText();
			if (text) EditorUtils.insertQuote(message.config.model, text);
		};

		const markdownContext = useMemo<MarkdownContext<string>>(
			() => ({ sources, streaming: live.state.generating }),
			[sources, live.state.generating],
		);

		if (message.author === Author.USER) {
			return (
				<Box className="selectable">
					<Markdown
						source={DataUtils.getText({
							data: message.data,
							join: "\n",
						})}
						maw={containerWidth > 40 ? containerWidth - 40 : undefined}
					/>
				</Box>
			);
		}

		const parts = DataUtils.getRenderedPartsGrouped(live, "thought");

		// An earlier model message with a newer timestamp means the chat was edited
		// above this response. Resolved for the whole list in MessageListProvider.
		const isStale = !live.state.any && staleIds.has(message.id);

		return (
			<>
				<Box
					w="100%"
					data-message-id={message.id}
					display="inline"
					className="selectable"
				>
					{isStale && (
						<Alert variant="light" mb="lg">
							<Group justify="space-between">
								<Group>
									<Icon icon="lucide:alert-circle" />
									<Text>Edits in the chat may change this response</Text>
								</Group>
								<ActionIcon variant="subtle" onClick={() => retry(message)}>
									<Icon icon="lucide:refresh-cw" />
								</ActionIcon>
							</Group>
						</Alert>
					)}
					{/* biome-ignore-start lint/suspicious/noArrayIndexKey: parts stay in order */}
					{parts.map((part, index) => {
						if (part.type === "group") {
							return (
								<Thought
									key={index}
									context={markdownContext}
									thoughts={part.value}
									textSize={TEXT_SM}
								/>
							);
						} else if (part.type === "toolCall") {
							const display = ToolCallUtils.getDisplay({
								part,
								toolsets,
							});
							return (
								<div key={part.id ?? index}>
									<ToolCall display={display} textSize={TEXT_SM} />
									{(display.approval ||
										display.feedback ||
										!!part.result?.append?.length) && (
										<ToolFeedback
											message={message}
											part={part}
											display={display}
											isFocused={nextFeedbackId === part.id}
										/>
									)}
								</div>
							);
						} else if (part.type === "text") {
							return (
								<Markdown
									key={index}
									source={part.value}
									context={markdownContext}
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
											colorScheme={theme}
										/>
										<DefaultVideoLayout
											icons={defaultLayoutIcons}
											colorScheme={theme}
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
											onClick={() => retry(message)}
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
