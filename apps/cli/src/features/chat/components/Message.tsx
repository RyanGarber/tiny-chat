import {
	Author,
	type MessageState,
} from "@tiny-chat/shared/src/features/data/types/message.ts";
import { DataUtils } from "@tiny-chat/shared/src/features/data/utils/DataUtils.ts";
import { Box, Text, useWindowSize } from "ink";
import { Task, TaskList } from "ink-task-list";
import { marked } from "marked";
import { type MarkedTerminalOptions, markedTerminal } from "marked-terminal";
import { type ReactNode, useEffect, useMemo, useState } from "react";

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

	const renderedParts = useMemo(() => {
		const renderedParts: ReactNode[] = [];

		const tasks: ReactNode[] = [];
		for (const part of message.data.flat()) {
			if (part.type === "thought") {
				tasks.push(<Task label="Thought" />);
			} else if (part.type === "toolCall") {
				tasks.push(<Task label={`Used ${part.name}`} />);
			} else if (part.type === "text") {
				if (tasks.length) {
					renderedParts.push(<TaskList>{...tasks}</TaskList>);
					tasks.splice(0, tasks.length);
				}
				renderedParts.push(
					<Text>
						{marked.parse(DataUtils.getText(message), {
							gfm: true,
						})}
					</Text>,
				);
			}
		}
		if (tasks.length) {
			renderedParts.push(<TaskList>{...tasks}</TaskList>);
		}

		return renderedParts;
	}, [message]);

	return (
		<Box
			flexDirection="column"
			alignSelf={message.author === Author.USER ? "flex-end" : "flex-start"}
			alignContent={message.author === Author.USER ? "flex-end" : "flex-start"}
			maxWidth={message.author === Author.USER ? "70%" : "100%"}
			paddingY={1}
		>
			<Box
				flexDirection="column"
				borderColor="gray"
				borderStyle="round"
				paddingX={1}
				gap={1}
			>
				{renderedParts}
			</Box>
			<Text dimColor>{message.config.model}</Text>
		</Box>
	);
}
