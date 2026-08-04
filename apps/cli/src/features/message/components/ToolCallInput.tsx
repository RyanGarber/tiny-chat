import { useToolCallInput } from "@tiny-chat/client/src/features/chat/hooks/useToolCallInput.ts";
import { useToolInput } from "@tiny-chat/client/src/features/chat/hooks/useToolInput.ts";
import type {
	MessageState,
	zDataPart,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import { DiffUtils } from "@tiny-chat/core/src/features/file/utils/DiffUtils.ts";
import type { ToolCallInputDetails } from "@tiny-chat/core/src/features/tool/utils/ToolCallUtils.ts";
import { Box, Text, useWindowSize } from "ink";
import { useCallback, useMemo, useRef, useState } from "react";
import { TextArea } from "react-ink-textarea";
import { useWorkingStatus } from "../../../core/hooks/useWorkingStatus.ts";
import { MarkdownUtils } from "../../../core/utils/MarkdownUtils.ts";
import { TerminalUtils } from "../../../core/utils/TerminalUtils.ts";
import Completions from "../../editor/components/Completions.tsx";

interface Option {
	label: string;
	approved?: boolean;
}

export const Preview = ({
	details,
	contents,
	limit,
}: {
	details: ToolCallInputDetails;
	contents: NonNullable<
		ReturnType<typeof useToolCallInput>["contents"]["data"]
	>;
	limit: number;
}) => {
	// biome-ignore-start lint/suspicious/noArrayIndexKey: lines stay in order
	if (details.kind === "shell_exec") {
		const lines = details.command.split("\n").slice(0, limit);
		return (
			<Box flexDirection="column">
				{lines.map((line, index) => (
					<Text key={index} color="cyan">
						{index === 0 ? "$ " : "  "}
						{line}
					</Text>
				))}
			</Box>
		);
	}

	if (details.kind === "write_file" || details.kind === "edit_file") {
		const diff = DiffUtils.context(
			DiffUtils.diff({
				before: contents.fileBefore ?? "",
				after: contents.fileAfter ?? "",
			}),
		);
		const diffShown = diff.slice(0, limit);
		const diffHiddenCount = diff.length - diffShown.length;

		return (
			<Box flexDirection="column">
				{diffShown.map((change, index) => {
					if (change.type === "unchanged") {
						return (
							<Text key={index} dimColor>
								{` ⋮ ${change.lines.length} unchanged line${change.lines.length === 1 ? "" : "s"}`}
							</Text>
						);
					}

					if (change.type === "changed") {
						return (
							<Text key={index}>
								{"~ "}
								{change.parts.map((part, partIndex) => {
									if (part.type === "changed") {
										return (
											<Text key={partIndex}>
												<Text color="red" underline>
													{part.partBefore}
												</Text>
												<Text color="green" underline>
													{part.partAfter}
												</Text>
											</Text>
										);
									}

									return (
										<Text
											key={partIndex}
											color={
												part.type === "added"
													? "green"
													: part.type === "removed"
														? "red"
														: undefined
											}
										>
											{part.part}
										</Text>
									);
								})}
							</Text>
						);
					}

					return (
						<Text
							key={index}
							color={
								change.type === "added"
									? "green"
									: change.type === "removed"
										? "red"
										: undefined
							}
						>
							{change.type === "added"
								? "+ "
								: change.type === "removed"
									? "- "
									: "  "}
							{change.line}
						</Text>
					);
				})}
				{diffHiddenCount > 0 && (
					<Text dimColor>{` ⋮ ${diffHiddenCount} more lines`}</Text>
				)}
			</Box>
		);
	}

	return <Text>{MarkdownUtils.render(details.question).trimEnd()}</Text>;
	// biome-ignore-end lint/suspicious/noArrayIndexKey: lines stay in order
};

export default function ToolCallInput({
	message,
	toolCall,
}: {
	message: MessageState;
	toolCall: Extract<zDataPart, { type: "toolCall" }>;
}) {
	const { rows } = useWindowSize();

	const { input, contents } = useToolCallInput({ message, toolCall });
	const { sendToolInput } = useToolInput();
	useWorkingStatus(contents, sendToolInput);

	const sendToolInputRef = useRef(sendToolInput);

	const details = input?.details;
	const question = details?.kind === "ask_question" ? details : undefined;

	const options = useMemo(
		(): Option[] =>
			input?.approval
				? [
						{ label: "approve", approved: true },
						{ label: "deny", approved: false },
					]
				: [{ label: "continue" }],
		[input?.approval],
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

	if (!input || !details) return null;

	return (
		<Completions
			before={
				<Box flexDirection="column" marginBottom={1}>
					{details.kind === "write_file" && (
						<Text>Write to {details.path}?</Text>
					)}
					{details.kind === "edit_file" && <Text>Edit {details.path}?</Text>}
					{details.kind === "shell_exec" && <Text>Run this command?</Text>}
					{contents.data && (
						<Preview
							details={details}
							contents={contents.data}
							limit={Math.max(Math.floor(rows / 3), 4)}
						/>
					)}
				</Box>
			}
			groups={[
				{
					items: [
						...(question?.suggestions.map((suggestion) => ({
							name: suggestion,
							value: suggestion,
						})) ?? []),
						{ value: "custom" },
					],
				},
			]}
			renderItem={({ item, selected }) => {
				if (item.value === "custom") {
					return (
						<Box marginTop={question ? 0 : 1} marginBottom={1}>
							<TextArea
								focus={selected && !sendToolInputRef.current.isPending}
								value={custom}
								onChange={(value) => setCustom(TerminalUtils.clean(value))}
								onSubmit={() => {}}
								initialLineCount={1}
								autoNewLineLimit={0}
								placeholder={
									question ? `something else...` : `optional follow-up...`
								}
							/>
						</Box>
					);
				} else {
					return item.name;
				}
			}}
			after={
				<Box gap={2}>
					{options.map((option, index) => (
						<Text
							key={option.label}
							color={index === selected ? "blue" : "gray"}
							bold={index === selected}
						>
							{index === selected ? "▶ " : "  "}
							{option.label}
						</Text>
					))}
				</Box>
			}
			onInput={({ item, key }) => {
				if (sendToolInputRef.current.isPending) return;

				if (key.leftArrow) {
					pick(-1);
				}
				if (key.rightArrow) {
					pick(1);
				}
				if (key.return && item) {
					if (question && item.value === "custom" && !custom.length) return;

					sendToolInputRef.current.mutate({
						seed: message,
						part: toolCall,
						approved: options[selected].approved,
						value: question
							? { answer: item.value === "custom" ? custom : item.value }
							: undefined,
						append:
							!question && custom.length
								? [{ type: "text", value: custom.trim() }]
								: undefined,
					});
				}
			}}
			actions={options.length > 1 ? [{ key: "←→", name: "pick" }] : []}
			minHeight={4}
		/>
	);
}
