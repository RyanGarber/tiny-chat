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
import { useMessageStore } from "@tiny-chat/client/src/features/message/stores/useMessageStore.ts";
import { useThemes } from "@tiny-chat/client/src/features/settings/hooks/useThemes.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { ToolCallUtils } from "@tiny-chat/core/src/features/tool/utils/ToolCallUtils.ts";
import { MediaPlayer, MediaProvider } from "@vidstack/react";
import {
	DefaultAudioLayout,
	DefaultVideoLayout,
	defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";
import { memo, useMemo } from "react";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";
import Code from "#app/features/code/components/Code.tsx";
import { EditorUtils } from "#app/features/editor/utils/EditorUtils.ts";
import { Markdown } from "#app/features/message/components/Markdown.tsx";
import { useMessageSelection } from "#app/features/message/hooks/useMessageSelection.ts";
import { ToolFeedback } from "#app/features/part/components/ToolFeedback.tsx";
import { Author, type MessageState } from "#core/features/data/types/message";
import { Thought } from "../../part/components/Thought.tsx";
import { ToolCall } from "../../part/components/ToolCall.tsx";

const TEXT_SM: BoxProps["className"] = "text-[10px]";

export const MessageBodyContent = memo(
	({
		message,
		live,
		version,
		containerWidth,
	}: {
		message: MessageState;
		/** Live stream snapshot, subscribed to once in `MessageBody`. */
		live: MessageState;
		/** Stream version `live` was read at. `live` is mutated in place, so this
		 * is the only thing that marks it as changed. */
		version: number;
		containerWidth: number;
	}) => {
		const { theme } = useThemes();

		const toolsets = useMessageStore((s) => s.toolsets);
		const nextFeedbackId = useMessageStore((s) => s.nextFeedbackId);
		const retry = useMessageStore((s) => s.retry);
		// An earlier model message with a newer timestamp means the chat was edited
		// above this response. Resolved for the whole list in MessageProvider.
		const isStaleId = useMessageStore((s) => s.staleIds.has(message.id));

		const { rect, captureSelection, getSelectedText } = useMessageSelection(
			message.id,
		);

		const isSelected = rect !== null;

		const handleQuoteClick = () => {
			const text = getSelectedText();
			if (text) EditorUtils.insertQuote(message.config.model, text);
		};

		const markdownContext = useMemo<MarkdownContext<string>>(
			() => ({ streaming: live.state.generating }),
			[live.state.generating],
		);

		// biome-ignore lint/correctness/useExhaustiveDependencies: `live` is mutated in place by the stream, so `version` is the only thing that marks it dirty
		const parts = useMemo(
			() => DataUtils.getRenderedPartsGrouped(live, "thought"),
			[live, version],
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

		const isStale = !live.state.any && isStaleId;

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
								<div key={index}>
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
									streaming={markdownContext.streaming}
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
