import { useMessageStream } from "@tiny-chat/client/src/features/chat/hooks/useStreaming.ts";
import {
	Author,
	type MessageState,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import cliSpinners from "cli-spinners";
import { Box, Text, useWindowSize } from "ink";
import Spinner from "ink-spinner";
import { Task, TaskList } from "ink-task-list";
import { marked } from "marked";
import { type MarkedTerminalOptions, markedTerminal } from "marked-terminal";
import { useEffect, useState } from "react";

const OPTIONS: Partial<MarkedTerminalOptions> = {
	emoji: true,
	showSectionPrefix: true,
	reflowText: false,
};

marked.use(markedTerminal(OPTIONS));

export default function Message({ message }: { message: MessageState }) {
	const { columns } = useWindowSize();

	const [_, setRendered] = useState(false);

	useEffect(() => {
		marked.use(
			markedTerminal({
				...OPTIONS,
				reflowText: true,
				width: columns - 3,
			}),
		);
		queueMicrotask(() => setRendered(true));
	}, [columns]);

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
										<Task
											key={part.id}
											label={`${!part.result ? "Using" : "Used"} ${part.name}`}
											state={
												!part.result
													? "loading"
													: part.result.error
														? "error"
														: "success"
											}
											spinner={cliSpinners.bluePulse}
										/>
									),
								)}
							</TaskList>
						);
					} else if (part.type === "text") {
						return (
							<Text>
								{marked.parse(DataUtils.getText(message), {
									gfm: true,
								})}
							</Text>
						);
					} else if (part.type === "abort") {
						return (
							<Box
								borderStyle="round"
								borderColor={part.reason === "error" ? "redBright" : "gray"}
							>
								{part.message ?? `Response ended due to ${part.reason}.`}
							</Box>
						);
					}
					return [];
				})}
				{live.state.generating && <Spinner type="bluePulse" />}
			</Box>
			<Text dimColor>{message.config.model}</Text>
		</Box>
	);
}
