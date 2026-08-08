import type { MessageState } from "@tiny-chat/core/src/features/data/types/message.ts";
import {
	DataUtils,
	type RenderedPart,
} from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import type { ToolCallDisplayType } from "@tiny-chat/core/src/features/tool/utils/ToolCallUtils.ts";
import chalk, { type ColorName } from "chalk";
import cliSpinners from "cli-spinners";
import { Box, Text } from "ink";
import { Task } from "ink-task-list";
import ToolFeedback from "./ToolFeedback.tsx";

export default function ToolCall({
	message,
	part,
	display,
	isExpanded,
	isFocused,
	textColor,
}: {
	message: MessageState;
	part: Extract<RenderedPart, { type: "toolCall" }>;
	display: ToolCallDisplayType;
	isExpanded?: boolean;
	isFocused?: boolean;
	textColor?: ColorName;
}) {
	const label = chalk.blueBright(
		display.status
			.map((part) =>
				typeof part === "string" ? part : chalk.bold(part.subject),
			)
			.join(" "),
	);

	return (
		<Task
			label={label}
			state={display.result === "pending" ? "loading" : display.result}
			spinner={cliSpinners.dots}
			isExpanded={
				isExpanded ||
				display.approval === "pending" ||
				display.feedback === "pending" ||
				!!display.append?.length
			}
		>
			<Box flexDirection="column" marginBottom={1}>
				{isExpanded && (
					<>
						<Text color={textColor} bold>
							Input
						</Text>
						<Text color={textColor}>
							{JSON.stringify(display.input, null, 2)}
							{`\n`}
						</Text>
						<Text color={textColor} bold>
							Output
						</Text>
						<Text color={textColor}>
							{JSON.stringify(display.output, null, 2)}
							{`\n`}
						</Text>
					</>
				)}
				{(display.approval === "pending" || display.feedback === "pending") && (
					<ToolFeedback
						message={message}
						part={part}
						display={display}
						isFocused={isFocused}
					/>
				)}
				{part.result?.append?.length && (
					<Box
						borderLeft={true}
						borderColor="gray"
						borderStyle="single"
						paddingLeft={1}
						gap={1}
					>
						<Text color="blueBright">{"+ "}</Text>
						<Text dimColor>
							{DataUtils.getText({ data: [part.result.append] })}
						</Text>
					</Box>
				)}
			</Box>
		</Task>
	);
}
