import { useMessageStream } from "@tiny-chat/client/src/features/chat/hooks/useStreaming.ts";
import {
	Author,
	type MessageState,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import cliSpinners from "cli-spinners";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { Task, TaskList } from "ink-task-list";
import { MarkdownUtils } from "../../../core/utils/MarkdownUtils.ts";
import ToolCall from "./ToolCall.tsx";

export default function Message({ message }: { message: MessageState }) {
	const stream = useMessageStream(
		message.author === Author.MODEL ? message.id : undefined,
	);
	const live = stream ?? message;

	const parts = DataUtils.getRenderedPartsGrouped(live, "thought", "toolCall");

	return (
		<Box
			flexDirection="column"
			alignSelf={message.author === Author.USER ? "flex-end" : "flex-start"}
			alignContent={message.author === Author.USER ? "flex-end" : "flex-start"}
			paddingX={1}
			paddingY={1}
		>
			<Box
				flexDirection="column"
				borderColor={message.author === Author.USER ? "gray" : undefined}
				borderStyle={message.author === Author.USER ? "round" : undefined}
				paddingX={1}
				gap={1}
			>
				{parts.flatMap((part) => {
					if (part.type === "group") {
						return (
							<TaskList>
								{part.value.map((part) =>
									part.type === "thought" ? (
										<Task
											key={part.id}
											label={part.active ? "Thinking" : "Thought"}
											state={part.active ? "loading" : "success"}
											spinner={cliSpinners.bluePulse}
										/>
									) : (
										<ToolCall
											key={part.id}
											toolCall={part}
											toolResult={part.result}
										/>
									),
								)}
							</TaskList>
						);
					} else if (part.type === "text") {
						return <Text>{MarkdownUtils.render(part.value)}</Text>;
					} else if (part.type === "abort") {
						return (
							<Box
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
						<Spinner type="bluePulse" />
					</Text>
				)}
			</Box>
			<Text dimColor>{message.config.model}</Text>
		</Box>
	);
}
