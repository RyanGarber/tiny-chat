import { useMessaging } from "@tiny-chat/client/src/features/chat/hooks/useMessaging.ts";
import { useToolDisplayContents } from "@tiny-chat/client/src/features/message/hooks/useToolDisplayContents.ts";
import { useToolStream } from "@tiny-chat/client/src/features/part/hooks/useToolStream.ts";
import type { ToolStreamState } from "@tiny-chat/client/src/features/part/services/ToolStreamService.ts";
import type { MessageState } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { RenderedPart } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import type { ToolCallDisplayType } from "@tiny-chat/core/src/features/tool/utils/ToolCallUtils.ts";
import { memo, useCallback, useMemo, useState } from "react";
import Box from "../../../core/components/Box.tsx";
import Text from "../../../core/components/Text.tsx";
import { useWorkingStatus } from "../../../core/hooks/useWorkingStatus.ts";
import { CliUtils } from "../../../core/utils/CliUtils.ts";
import { Code } from "../../code/components/Code.tsx";
import Diff from "../../code/components/Diff.tsx";
import Completions from "../../editor/components/Completions.tsx";
import Textarea from "../../editor/components/Textarea.tsx";
import Markdown from "../../message/components/Markdown.tsx";

interface Option {
	label: string;
	approved?: boolean;
}

/** How much of a running command's output stays on screen. */
const VISIBLE_LINES = 10;

/**
 * Output of a command that is still running. It stands in for the tool result
 * until there is one, so it stays on screen until the result has been saved.
 */
function ToolStream({ stream }: { stream: ToolStreamState }) {
	const lines = stream.lines.slice(-VISIBLE_LINES);
	const hidden = stream.lines.length - lines.length;

	return (
		<Box flexDirection="column" marginTop={1}>
			<Text dimColor>
				{stream.done ? "finished" : "running"}
				{hidden > 0 || stream.truncated
					? ` · ${hidden > 0 ? `${hidden} earlier line${hidden === 1 ? "" : "s"} hidden` : "earlier output hidden"}`
					: ""}
			</Text>
			{lines.map((line, index) => (
				<Text
					// biome-ignore lint/suspicious/noArrayIndexKey: lines stay in order
					key={index}
					color={line.stream === "stderr" ? "red" : undefined}
					dimColor={line.stream !== "stderr"}
					wrap="truncate-end"
				>
					{CliUtils.display(line.value) || " "}
				</Text>
			))}
		</Box>
	);
}

export const ToolFeedback = memo(
	({
		message,
		part,
		display,
		isFocused = false,
	}: {
		message: MessageState;
		part: Extract<RenderedPart, { type: "toolCall" }>;
		display: ToolCallDisplayType;
		isFocused?: boolean;
	}) => {
		const { contents } = useToolDisplayContents({ message, part, display });
		const { sendToolFeedback } = useMessaging();
		useWorkingStatus(contents, sendToolFeedback);

		const { stream } = useToolStream({ message, part });

		// Nothing can be sent twice: the controls stay locked from the moment
		// feedback is sent until the result it produces has been saved, which is
		// also when this component goes away.
		const locked = sendToolFeedback.isPending || display?.result !== "pending";

		const options = useMemo(
			(): Option[] =>
				display?.approval
					? [
							{ label: "approve", approved: true },
							{ label: "deny", approved: false },
						]
					: [{ label: "continue" }],
			[display?.approval],
		);
		const [selected, setSelected] = useState(0);

		const [custom, setCustom] = useState("");

		const pick = useCallback(
			(offset: number) => {
				setSelected((previous) =>
					Math.min(Math.max(previous + offset, 0), options.length - 1),
				);
			},
			[options.length],
		);

		if (!display) return null;

		return (
			<Completions
				before={
					<Box flexDirection="column" marginBottom={1}>
						{(display.name === "write_file" ||
							display.name === "edit_file") && (
							<>
								<Text>Edit {display.input.path}?</Text>
								<Diff
									before={contents.data?.fileBefore ?? ""}
									after={contents.data?.fileAfter ?? ""}
									language={display.language}
								/>
							</>
						)}
						{display.name === "shell_exec" && (
							<>
								<Text>Run this command?</Text>
								<Code code={display.input.command} language="shell" />
								{stream && <ToolStream stream={stream} />}
							</>
						)}
						{display.name === "ask_question" && (
							<>
								<Text>Input needed</Text>
								<Markdown source={display.input.question} />
							</>
						)}
					</Box>
				}
				groups={[
					{
						items: [
							...(display.name === "ask_question"
								? display.input.suggestions.map((suggestion) => ({
										name: suggestion,
										value: suggestion,
									}))
								: []),
							{ value: "custom" },
						],
					},
				]}
				renderItem={({ item, selected }) => {
					if (item.value === "custom") {
						return (
							<Textarea
								focus={isFocused && selected && !locked}
								value={custom}
								onChange={setCustom}
								initialLineCount={1}
								autoNewLineLimit={0}
								placeholder={
									display.name === "ask_question"
										? `something else...`
										: `optional follow-up...`
								}
							/>
						);
					} else {
						return item.name;
					}
				}}
				after={
					<Box gap={2}>
						{options.map((option, index) => {
							const active = isFocused && !locked && index === selected;
							return (
								<Text
									key={option.label}
									color={active ? "blue" : "gray"}
									bold={active}
									dimColor={locked}
								>
									{active ? "▶ " : "  "}
									{option.label}
								</Text>
							);
						})}
						{locked && (
							<Text dimColor>
								{display.name === "shell_exec" && !stream?.done
									? "running..."
									: "sending..."}
							</Text>
						)}
					</Box>
				}
				onInput={({ item, key, pointer }) => {
					if (locked || !isFocused) return false;

					// Shift belongs to the text area, which selects its text by it.
					if (key.shift) return false;

					// A press on the follow-up field is how the cursor is put into it,
					// and how a selection is started, so it is not taken as a send.
					if (pointer && item?.value === "custom") return false;

					if (key.leftArrow) {
						pick(-1);
					}
					if (key.rightArrow) {
						pick(1);
					}
					if (key.return && item) {
						if (
							display.name === "ask_question" &&
							item.value === "custom" &&
							!custom.length
						)
							return;

						sendToolFeedback.mutate({
							seed: message,
							part,
							approved: options[selected].approved,
							value:
								display.name === "ask_question"
									? { answer: item.value === "custom" ? custom : item.value }
									: undefined,
							append:
								display.name !== "ask_question" && custom.length
									? [{ type: "text", value: custom.trim() }]
									: undefined,
						});
					}
				}}
				actions={options.length > 1 ? [{ key: "←→", name: "pick" }] : []}
				minHeight={4}
			/>
		);
	},
	(previous, next) =>
		previous.message.id === next.message.id &&
		previous.part.id === next.part.id &&
		previous.display === next.display &&
		previous.isFocused === next.isFocused,
);
