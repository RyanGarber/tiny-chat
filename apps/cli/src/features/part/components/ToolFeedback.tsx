/** biome-ignore-all lint/suspicious/noArrayIndexKey: parts stay in order */

import { useMessaging } from "@tiny-chat/client/src/features/chat/hooks/useMessaging.ts";
import { useToolContents } from "@tiny-chat/client/src/features/message/hooks/useToolContents.ts";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import type { MessageState } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { RenderedPart } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import type { ToolCallDisplayType } from "@tiny-chat/core/src/features/tool/utils/ToolCallUtils.ts";
import { useCallback, useMemo, useState } from "react";
import Box from "../../../core/components/Box.tsx";
import Text from "../../../core/components/Text.tsx";
import { useWorkingStatus } from "../../../core/hooks/useWorkingStatus.ts";
import { Code } from "../../code/components/Code.tsx";
import Diff from "../../code/components/Diff.tsx";
import Completions from "../../editor/components/Completions.tsx";
import Textarea from "../../editor/components/Textarea.tsx";
import Markdown from "../../message/components/Markdown.tsx";

interface Option {
	label: string;
	approved?: boolean;
}

export default function ToolFeedback({
	message,
	part,
	display,
	isFocused = false,
}: {
	message: MessageState;
	part: Extract<RenderedPart, { type: "toolCall" }>;
	display: ToolCallDisplayType;
	isFocused?: boolean;
}) {
	const { contents } = useToolContents({ message, part, display });
	const { sendToolFeedback } = useMessaging();
	useWorkingStatus(contents, sendToolFeedback);

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
					{(display.name === "write_file" || display.name === "edit_file") && (
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
						...(display.name === "spawn_subagent"
							? [
									{
										name: "Default",
										value: JSON.stringify(display.feedbackDefault),
									},
								]
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
						feedback:
							display.name === "ask_question"
								? { answer: item.value === "custom" ? custom : item.value }
								: display.name === "spawn_subagent"
									? JSON.parse(item.value)
									: undefined,
						append:
							display.name !== "ask_question" && custom.length
								? [
										{
											id: CommonUtils.getRandomId(),
											type: "text",
											value: custom.trim(),
										},
									]
								: undefined,
					});
				}
			}}
			actions={options.length > 1 ? [{ key: "←→", name: "pick" }] : []}
			minHeight={4}
		/>
	);
}
