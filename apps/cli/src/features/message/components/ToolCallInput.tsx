import { useToolCallInput } from "@tiny-chat/client/src/features/chat/hooks/useToolCallInput.ts";
import { useToolInput } from "@tiny-chat/client/src/features/chat/hooks/useToolInput.ts";
import type {
	MessageState,
	zDataPart,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import { DiffUtils } from "@tiny-chat/core/src/features/file/utils/DiffUtils.ts";
import type { ToolCallInputDetails } from "@tiny-chat/core/src/features/tool/utils/ToolCallUtils.ts";
import { Box, Text, useInput, useWindowSize } from "ink";
import Spinner from "ink-spinner";
import { useCallback, useMemo, useState } from "react";
import { TextArea } from "react-ink-textarea";
import HelpText from "../../../core/components/HelpText.tsx";
import { MarkdownUtils } from "../../../core/utils/MarkdownUtils.ts";
import { TerminalUtils } from "../../../core/utils/TerminalUtils.ts";

interface Option {
	label: string;
	approved?: boolean;
}

/** Where the keystrokes go while a tool call waits on the user. */
type Focus = "options" | "answer" | "prompt";

const Preview = ({
	details,
	contents,
	limit,
}: {
	details: ToolCallInputDetails;
	contents: string;
	/** Rows the preview may take before the chat above it gets squeezed */
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

	if (details.kind === "write_file") {
		const lines = DiffUtils.collapse({
			lines: DiffUtils.getLines({
				before: contents,
				after: details.content,
			}),
		});
		const shown = lines.slice(0, limit);
		const hidden = lines.length - shown.length;

		return (
			<Box flexDirection="column">
				{shown.map((line, index) =>
					line.type === "gap" ? (
						<Text key={index} dimColor>
							{` ⋮ ${line.count} unchanged line${line.count === 1 ? "" : "s"}`}
						</Text>
					) : (
						<Text
							key={index}
							color={
								line.type === "add"
									? "green"
									: line.type === "remove"
										? "red"
										: undefined
							}
							dimColor={line.type === "context"}
						>
							{line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
							{line.value}
						</Text>
					),
				)}
				{hidden > 0 && <Text dimColor>{` ⋮ ${hidden} more lines`}</Text>}
			</Box>
		);
	}

	return <Text>{MarkdownUtils.render(details.question).trimEnd()}</Text>;
	// biome-ignore-end lint/suspicious/noArrayIndexKey: lines stay in order
};

export default function ToolCallInput({
	message,
	toolCall,
	waiting,
}: {
	message: MessageState;
	toolCall: Extract<zDataPart, { type: "toolCall" }>;
	/** How many other tool calls are queued up behind this one */
	waiting: number;
}) {
	const { rows } = useWindowSize();

	const { input, contents } = useToolCallInput({ message, toolCall });
	const { sendToolInput } = useToolInput();

	const details = input?.details;
	const question = details?.kind === "ask_question" ? details : undefined;

	const options = useMemo(
		(): Option[] =>
			input?.approval
				? [
						{ label: "Approve", approved: true },
						{ label: "Deny", approved: false },
					]
				: [{ label: "Continue" }],
		[input?.approval],
	);

	const [selected, setSelected] = useState(0);
	const [suggestion, setSuggestion] = useState(-1);
	const [answer, setAnswer] = useState("");
	const [prompt, setPrompt] = useState("");
	const [focus, setFocus] = useState<Focus>("options");

	const busy = sendToolInput.isPending;

	const submit = useCallback(() => {
		const option = options[selected];
		if (!option || busy) return;
		// A question with nothing written yet is not worth sending back.
		if (question && !answer.trim()) return setFocus("answer");
		sendToolInput.mutate({
			seed: message,
			part: toolCall,
			approved: option.approved,
			value: question ? { answer: answer.trim() } : undefined,
			append: prompt.trim()
				? [{ type: "text", value: prompt.trim() }]
				: undefined,
		});
	}, [
		answer,
		busy,
		message,
		options,
		prompt,
		question,
		selected,
		sendToolInput,
		toolCall,
	]);

	const pick = useCallback(
		(offset: number) => {
			setSelected((previous) =>
				Math.min(Math.max(previous + offset, 0), options.length - 1),
			);
		},
		[options.length],
	);

	const suggest = useCallback(
		(offset: number) => {
			const suggestions = question?.suggestions ?? [];
			if (!suggestions.length) return;
			setSuggestion((previous) => {
				const next = Math.min(
					Math.max(previous + offset, 0),
					suggestions.length - 1,
				);
				setAnswer(suggestions[next]);
				return next;
			});
		},
		[question?.suggestions],
	);

	useInput(
		(character, key) => {
			const text = TerminalUtils.clean(character);
			if (key.upArrow) {
				if (question) suggest(-1);
				else pick(-1);
			} else if (key.downArrow) {
				if (question) suggest(1);
				else pick(1);
			} else if (key.leftArrow) {
				pick(-1);
			} else if (key.rightArrow || key.tab) {
				pick(1);
			} else if (key.return) {
				submit();
			} else if (text === " ") {
				setFocus("prompt");
			} else if (
				question &&
				text.length === 1 &&
				text >= " " &&
				!key.ctrl &&
				!key.meta
			) {
				// Typing anywhere is meant for the answer, so keep the character.
				setAnswer((previous) => previous + text);
				setFocus("answer");
			}
		},
		{ isActive: focus === "options" && !busy },
	);

	useInput(
		(_, key) => {
			if (!key.escape) return;
			if (focus === "prompt") setPrompt("");
			setFocus("options");
		},
		{ isActive: focus !== "options" && !busy },
	);

	if (!input || !details) return null;

	const title =
		details.kind === "shell_exec"
			? "Run this command?"
			: details.kind === "write_file"
				? `Write ${details.path}?`
				: "Answer to continue";

	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor={input.approval ? "yellow" : "blueBright"}
			paddingX={1}
			minHeight={7}
		>
			<Text color={input.approval ? "yellow" : "blueBright"}>
				{title}
				{waiting > 0 ? ` (${waiting} more waiting)` : ""}
			</Text>

			<Preview
				details={details}
				contents={contents}
				limit={Math.max(Math.floor(rows / 3), 4)}
			/>

			{question && (
				<Box flexDirection="column" marginTop={1}>
					{question.suggestions.map((value, index) => (
						<Text
							key={value}
							color={index === suggestion ? "blue" : undefined}
							dimColor={index !== suggestion}
						>
							{index === suggestion ? "▶ " : "  "}
							{value}
						</Text>
					))}
					<Box>
						<Text color={focus === "answer" ? "blueBright" : "gray"}>
							{"> "}
						</Text>
						<TextArea
							focus={focus === "answer" && !busy}
							value={answer}
							onChange={(value) => setAnswer(TerminalUtils.clean(value))}
							onSubmit={submit}
							viewportLines={1}
							placeholder="Type an answer"
						/>
					</Box>
				</Box>
			)}

			{focus === "prompt" && (
				<Box marginTop={1}>
					<Text color="blueBright">{"+ "}</Text>
					<TextArea
						focus={!busy}
						value={prompt}
						onChange={(value) => setPrompt(TerminalUtils.clean(value))}
						onSubmit={submit}
						viewportLines={1}
						placeholder={`Add a follow-up for ${message.config.model}`}
					/>
				</Box>
			)}

			<Box marginTop={1} gap={2}>
				{busy ? (
					<Text color="gray">
						<Spinner type="bluePulse" />
					</Text>
				) : (
					options.map((option, index) => (
						<Text
							key={option.label}
							color={index === selected ? "blue" : "gray"}
							bold={index === selected}
						>
							{index === selected ? "▶ " : "  "}
							{option.label}
						</Text>
					))
				)}
			</Box>

			{focus === "options" && (
				<HelpText
					actions={[
						{
							key: "←→",
							name: "choose",
							when: focus === "options" && options.length > 1,
						},
						{
							key: "↑↓",
							name: "suggestion",
							when: focus === "options" && !!question,
						},
						{ key: "space", name: "follow up", when: focus === "options" },
						{ key: "enter", name: "send" },
						{ key: "esc", name: "back", when: focus !== "options" },
					]}
				/>
			)}
		</Box>
	);
}
