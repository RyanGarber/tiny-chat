/** biome-ignore-all lint/suspicious/noArrayIndexKey: parts stay in order */

import type { AgentStreamEvent } from "@tiny-chat/client/src/core/services/StreamService.ts";
import { useStream } from "@tiny-chat/client/src/features/agent/hooks/useStream.ts";
import type { MarkdownContext } from "@tiny-chat/client/src/features/message/components/MarkdownContext.tsx";
import { useMessageStore } from "@tiny-chat/client/src/features/message/stores/useMessageStore.ts";
import {
	Author,
	type MessageState,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { ToolCallUtils } from "@tiny-chat/core/src/features/tool/utils/ToolCallUtils.ts";
import type { ColorName } from "chalk";
import { useWindowSize } from "ink";
import Spinner from "ink-spinner";
import { useMemo } from "react";
import Box from "../../../core/components/Box.tsx";
import Text from "../../../core/components/Text.tsx";
import Task from "../../part/components/Task.tsx";
import Thought from "../../part/components/Thought.tsx";
import ToolCall from "../../part/components/ToolCall.tsx";
import Markdown from "./Markdown.tsx";

export default function Message({ message }: { message: MessageState }) {
	const toolsets = useMessageStore((s) => s.toolsets);
	const nextFeedbackId = useMessageStore((s) => s.nextFeedbackId);

	const { columns } = useWindowSize();

	const stream = useStream<AgentStreamEvent>(message.id)?.items.at(-1);
	const streamed = useMemo(
		() => ({ ...message, ...stream }),
		[message, stream],
	);
	const markdownContext = useMemo<MarkdownContext<never, ColorName>>(
		() => ({ streaming: streamed.status === "generating" }),
		[streamed.status],
	);

	const parts = useMemo(
		() =>
			DataUtils.getRenderedPartsGrouped(
				streamed.data,
				streamed.status === "thinking",
				"thought",
				"toolCall",
			),
		[streamed],
	);
	let lastIndex = -1;

	return (
		<Box flexDirection="column" paddingX={1} paddingY={1}>
			<Box
				flexDirection="column"
				backgroundColor={message.author === Author.USER ? "surface" : undefined}
				paddingY={message.author === Author.USER ? 1 : 0}
				paddingX={2}
				gap={1}
				maxWidth={columns - 3}
			>
				{parts.flatMap((part, index) => {
					if (part.type === "group") {
						return (
							<Task.Group
								key={index}
								detailsProps={{
									paddingY: 1,
									backgroundColor: "surface",
								}}
							>
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
												isFocused={part.id === nextFeedbackId}
											/>
										);
									}
									return [];
								})}
							</Task.Group>
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
				{!!streamed.status && (
					<Text>
						<Spinner type="simpleDotsScrolling" />
					</Text>
				)}
			</Box>
			<Box paddingLeft={2} paddingTop={1}>
				<Text color="textSubtle">➤ {message.config.model}</Text>
			</Box>
		</Box>
	);
}
