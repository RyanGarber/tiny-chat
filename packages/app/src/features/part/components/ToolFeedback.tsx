/** biome-ignore-all lint/suspicious/noArrayIndexKey: parts stay in order */

import { Icon } from "@iconify/react";
import {
	Alert,
	Box,
	Button,
	Card,
	Grid,
	Group,
	Loader,
	Radio,
	ScrollAreaAutosize,
	Stack,
	Text,
	Textarea,
} from "@mantine/core";
import type { ToolStreamEvent } from "@tiny-chat/client/src/core/services/StreamService.ts";
import { useStream } from "@tiny-chat/client/src/features/agent/hooks/useStream.ts";
import { useMessaging } from "@tiny-chat/client/src/features/chat/hooks/useMessaging.ts";
import { useToolContents } from "@tiny-chat/client/src/features/message/hooks/useToolContents.ts";
import {
	DataUtils,
	type RenderedPart,
} from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import type { ask_question } from "@tiny-chat/core/src/features/tool/tools/questions/ask_question.ts";
import { shell_exec } from "@tiny-chat/core/src/features/tool/tools/shell/shell_exec.ts";
import { spawn_subagent } from "@tiny-chat/core/src/features/tool/tools/subagents/spawn_subagent.ts";
import type { ToolDefinition } from "@tiny-chat/core/src/features/tool/types/tool.ts";
import type { ToolCallDisplayType } from "@tiny-chat/core/src/features/tool/utils/ToolCallUtils.ts";
import {
	memo,
	type ReactNode,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { z } from "zod";
import ModelSelect from "#app/core/components/ModelSelect.tsx";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";
import Code from "#app/features/code/components/Code.tsx";
import Diff from "#app/features/code/components/Diff.tsx";
import { Markdown } from "#app/features/message/components/Markdown.tsx";
import { Thought } from "#app/features/part/components/Thought.tsx";
import type {
	MessageState,
	zConfig,
	zDataBasicPart,
} from "#core/features/data/types/message";

/**
 * Output of a command that is still running. It stands in for the tool result
 * until there is one, so it stays mounted until the result has been saved.
 */
const ToolStream = <T extends ToolDefinition>({
	tool,
	id,
}: {
	tool: T;
	id: string;
}) => {
	const stream = useStream<ToolStreamEvent<T>>(id);

	// Follow the tail the way a terminal does.
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const element = ref.current;
		if (element && stream?.items.length) {
			element.scrollTop = element.scrollHeight;
		}
	}, [stream]);

	if (!stream) {
		return null;
	}

	// TODO - use code + scrollarea
	if (tool.name === shell_exec.name) {
		const lines = stream.items as ToolStreamEvent<typeof shell_exec>[];
		return (
			<Stack gap={4}>
				<Group gap="xs">
					<Loader size={12} />
					<Text size="xs" c="dimmed">
						{"Running"}
						{stream.truncated ? " · earlier output hidden" : ""}
					</Text>
				</Group>
				{!!lines.length && (
					<Box
						ref={ref}
						p="xs"
						mah={260}
						style={{
							overflowY: "auto",
							borderRadius: "var(--mantine-radius-sm)",
							background: "var(--mantine-color-default)",
						}}
					>
						{lines.map((line, index) => (
							<Text
								key={index}
								ff="monospace"
								size="xs"
								c={line.type === "stderr" ? "red" : undefined}
								style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}
							>
								{line.value || " "}
							</Text>
						))}
					</Box>
				)}
			</Stack>
		);
	} else if (tool.name === spawn_subagent.name) {
		const data = (stream.items as ToolStreamEvent<typeof spawn_subagent>[]).at(
			-1,
		);
		if (!data) return null;

		const parts = DataUtils.getRenderedPartsGrouped(
			data,
			data.at(-1)?.at(-1)?.type === "thought",
			"thought",
		);
		return (
			<ScrollAreaAutosize mah={400}>
				<Stack gap={4}>
					{parts.flatMap((part, index) => {
						if (part.type === "group") {
							return <Thought thoughts={part.value} />;
						} else if (part.type === "toolCall") {
							return (
								<Box key={index}>
									<Text c="dimmed">
										{!part.result ? "Using tool" : "Used tool"} {part.name}
									</Text>
								</Box>
							);
						} else if (part.type === "text") {
							return <Markdown key={index} source={part.value} />;
						}
						return [];
					})}
				</Stack>
			</ScrollAreaAutosize>
		);
	}

	return null;
};

export const ToolFeedback = memo(
	({
		message,
		part,
		display,
		isFocused,
	}: {
		message: MessageState;
		part: Extract<RenderedPart, { type: "toolCall" }>;
		display: ToolCallDisplayType;
		isFocused?: boolean;
	}) => {
		const { sendToolFeedback } = useMessaging();

		const { contents } = useToolContents({
			message,
			part,
			display,
		});

		// Nothing can be sent twice: the controls stay locked from the moment
		// feedback is sent until the result it produces has been saved.
		const locked = sendToolFeedback.isPending || display.result !== "pending";

		const [inputValue, setInputValue] = useState<unknown>(part.result?.value);
		const [appendValue, setAppendValue] = useState<Extract<
			zDataBasicPart,
			{ type: "text" }
		> | null>();

		useEffect(() => {
			if (display?.name === "spawn_subagent") {
				setInputValue(message.config);
			}
		}, [display?.name, message.config]);

		const input: ReactNode | undefined = useMemo(() => {
			if (display?.name === "shell_exec" && display.result === "pending") {
				return (
					<>
						<Code language="bash" code={display.input.command} />
						<ToolStream tool={shell_exec} id={part.id} />
					</>
				);
			} else if (
				(display?.name === "write_file" || display?.name === "edit_file") &&
				display.result === "pending"
			) {
				return (
					<Diff
						filename={display.language}
						language={display.language}
						before={contents.data?.fileBefore ?? ""}
						after={contents.data?.fileAfter ?? ""}
					/>
				);
			} else if (display?.name === "ask_question") {
				return (
					<>
						<Box>
							<Markdown source={display.input.question} />
						</Box>
						<Grid grow>
							{display.input.suggestions.map((suggestion) => (
								<Grid.Col key={suggestion} span={4} align="stretch">
									<Radio.Card
										p="md"
										h="100%"
										checked={
											(
												inputValue as
													| z.infer<NonNullable<typeof ask_question.feedback>>
													| undefined
											)?.answer === suggestion
										}
										disabled={locked || !isFocused}
										defaultChecked={
											(
												inputValue as
													| z.infer<NonNullable<typeof ask_question.feedback>>
													| undefined
											)?.answer === suggestion
										}
										onClick={() =>
											setInputValue({
												answer: suggestion,
											} satisfies z.infer<
												NonNullable<typeof ask_question.feedback>
											>)
										}
									>
										<Group wrap="nowrap" align="flex-start" h="100%">
											<Radio.Indicator />
											<Box>
												<Text>{suggestion}</Text>
											</Box>
										</Group>
									</Radio.Card>
								</Grid.Col>
							))}
						</Grid>
						<Textarea
							autosize
							minRows={1}
							maxRows={10}
							placeholder="…"
							value={
								(
									inputValue as
										| z.infer<NonNullable<typeof ask_question.feedback>>
										| undefined
								)?.answer
							}
							disabled={locked || !isFocused}
							onChange={(e) =>
								setInputValue({
									answer: e.target.value,
								} satisfies z.infer<NonNullable<typeof ask_question.feedback>>)
							}
						/>
					</>
				);
			} else if (
				display?.name === "spawn_subagent" &&
				display.result === "pending"
			) {
				return (
					<>
						<Text>Subagent</Text>
						<ModelSelect
							feature="language"
							configValue={inputValue as zConfig}
							onConfigChange={setInputValue}
							disabled={locked || !isFocused}
						/>
						<ToolStream tool={spawn_subagent} id={part.id} />
					</>
				);
			}
		}, [contents.data, inputValue, display, isFocused, locked, part.id]);

		const followUp = (
			<Box
				style={{ borderLeft: "2px solid var(--tc-interior)" }}
				pl={15}
				ml={7.5}
				flex={1}
			>
				<Textarea
					autosize
					disabled={locked || !isFocused}
					placeholder="Add follow-up..."
					value={
						part.result?.append
							? DataUtils.getText({ data: [part.result.append] })
							: appendValue?.value
					}
					onChange={(event) =>
						setAppendValue(
							event.target.value.trim().length
								? { type: "text", value: event.target.value }
								: null,
						)
					}
				/>
			</Box>
		);

		if (input) {
			return (
				<Stack gap="xs" mb={10}>
					<Card withBorder style={{ ...StyleUtils.glass }}>
						<Stack gap="xs">{input}</Stack>
					</Card>
					<Group gap="xs" justify="flex-end">
						{followUp}
						{display?.approval ? (
							<Group gap="xs">
								<Button
									size="xs"
									onClick={() =>
										sendToolFeedback.mutate({
											seed: message,
											part,
											approved: true,
											value: inputValue,
											append: appendValue,
										})
									}
									leftSection={
										display.approval === "approved" && (
											<Icon icon="lucide:check" />
										)
									}
									loading={
										sendToolFeedback.isPending &&
										sendToolFeedback.variables?.approved === true
									}
									disabled={locked || !isFocused}
								>
									Approve
								</Button>
								<Button
									size="xs"
									variant="default"
									onClick={() =>
										sendToolFeedback.mutate({
											seed: message,
											part,
											approved: false,
											value: inputValue,
											append: appendValue,
										})
									}
									leftSection={
										display.approval === "rejected" && (
											<Icon icon="lucide:check" />
										)
									}
									loading={
										sendToolFeedback.isPending &&
										sendToolFeedback.variables?.approved === false
									}
									disabled={locked || !isFocused}
								>
									Deny
								</Button>
							</Group>
						) : (
							<Button
								size="xs"
								variant="filled"
								onClick={() =>
									sendToolFeedback.mutate({
										seed: message,
										part,
										value: inputValue,
										append: appendValue,
									})
								}
								leftSection={
									display.result !== "pending" && <Icon icon="lucide:check" />
								}
								loading={sendToolFeedback.isPending}
								disabled={locked || !isFocused}
							>
								Continue
							</Button>
						)}
					</Group>
				</Stack>
			);
		}

		if (display.result === "pending") {
			return (
				<Alert color="red" title="Error">
					Tool <code>{part?.name}</code> can't be used in this context.
				</Alert>
			);
		} else if (part.result?.append?.length) {
			return followUp;
		}
	},
	(previous, next) =>
		previous.message.id === next.message.id &&
		previous.part.id === next.part.id &&
		previous.display === next.display &&
		previous.isFocused === next.isFocused,
);
