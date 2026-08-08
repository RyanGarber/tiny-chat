/** biome-ignore-all lint/suspicious/noArrayIndexKey: parts stay in order */
import type { MarkdownContext } from "@tiny-chat/client/src/features/message/components/MarkdownContext.tsx";
import { MessageContext } from "@tiny-chat/client/src/features/message/components/MessageContext.tsx";
import { useMessageStream } from "@tiny-chat/client/src/features/message/hooks/useMessageStream.ts";
import {
	Author,
	type MessageState,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { ToolCallUtils } from "@tiny-chat/core/src/features/tool/utils/ToolCallUtils.ts";
import type { ColorName } from "chalk";
import { Box, Text, useWindowSize } from "ink";
import Spinner from "ink-spinner";
import { TaskList } from "ink-task-list";
import { useContext, useMemo } from "react";
import Markdown from "./Markdown.tsx";
import Thought from "./Thought.tsx";
import ToolCall from "./ToolCall.tsx";

const COLOR_DIM: ColorName = "gray";

export default function Message({
	message,
	expanded,
}: {
	message: MessageState;
	expanded: boolean;
}) {
	const { columns } = useWindowSize();

	const { sources, toolsets, nextFeedbackId } = useContext(MessageContext);

	const stream = useMessageStream(
		message.author === Author.MODEL ? message.id : undefined,
	);
	const live = stream ?? message;
	const markdownContext = useMemo<MarkdownContext<never, ColorName>>(
		() => ({ sources, streaming: live.state.generating }),
		[sources, live.state.generating],
	);

	const parts = DataUtils.getRenderedPartsGrouped(live, "thought", "toolCall");
	let lastIndex = -1;

	return (
		<Box flexDirection="column" paddingX={1} paddingY={1}>
			<Box
				flexDirection="column"
				borderColor={message.author === Author.USER ? "gray" : undefined}
				borderStyle={message.author === Author.USER ? "round" : undefined}
				paddingX={1}
				gap={1}
				maxWidth={columns - 3}
			>
				{parts.flatMap((part, index) => {
					if (part.type === "group") {
						return (
							<TaskList key={index}>
								{part.value.flatMap((part, index, parts) => {
									if (part.type === "thought") {
										if (index <= lastIndex) return [];
										lastIndex = index;
										const thoughts = [part];
										for (const nextPart of parts.slice(index + 1)) {
											if (nextPart.type !== "thought") break;
											thoughts.push(nextPart);
											lastIndex++;
										}
										return (
											<Thought
												key={lastIndex}
												thoughts={thoughts}
												context={markdownContext}
												isExpanded={expanded}
												textColor={COLOR_DIM}
											/>
										);
									} else if (part.type === "toolCall") {
										const display = ToolCallUtils.getDisplay({
											part,
											toolsets,
										});
										return (
											<ToolCall
												key={index}
												message={message}
												part={part}
												display={display}
												isExpanded={expanded}
												isFocused={part.id === nextFeedbackId}
												textColor={COLOR_DIM}
											/>
										);
									}
									return [];
								})}
							</TaskList>
						);
					} else if (part.type === "text") {
						return (
							<Markdown
								key={index}
								source={part.value}
								context={markdownContext}
							/>
						);
					} else if (part.type === "abort") {
						return (
							<Box
								key={index}
								borderStyle="round"
								borderColor={part.reason === "error" ? "redBright" : "gray"}
								flexDirection="column"
								paddingX={1}
							>
								<Text bold>
									{part.reason === "error" ? "Failed" : "Stopped"}
								</Text>
								<Text>
									{part.message ?? `Response ended due to ${part.reason}.`}
								</Text>
							</Box>
						);
					}
					return [];
				})}
				{live.state.any && (
					<Text>
						<Spinner type="simpleDotsScrolling" />
					</Text>
				)}
			</Box>
			<Text dimColor>➤ {message.config.model}</Text>
		</Box>
	);
}
