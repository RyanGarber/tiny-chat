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
	Stack,
	Text,
	Textarea,
} from "@mantine/core";
import { useMessaging } from "@tiny-chat/client/src/features/chat/hooks/useMessaging.ts";
import { useToolDisplayContents } from "@tiny-chat/client/src/features/message/hooks/useToolDisplayContents.ts";
import { useToolStream } from "@tiny-chat/client/src/features/tool/hooks/useToolStream.ts";
import type { ToolStreamState } from "@tiny-chat/client/src/features/tool/services/ToolStreamService.ts";
import {
	DataUtils,
	type RenderedPart,
} from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import type { ask_question } from "@tiny-chat/core/src/features/tool/tools/questions/ask_question.ts";
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
import { Code, Diff } from "#app/core/components/Components.tsx";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";
import { Markdown } from "#app/features/message/components/Markdown.tsx";
import type {
	MessageState,
	zDataBasicPart,
} from "#core/features/data/types/message";

/**
 * Output of a command that is still running. It stands in for the tool result
 * until there is one, so it stays mounted until the result has been saved.
 */
const ToolStream = ({ stream }: { stream: ToolStreamState }) => {
	const ref = useRef<HTMLDivElement>(null);

	// Follow the tail the way a terminal does.
	const { lines } = stream;
	useEffect(() => {
		const element = ref.current;
		if (element && lines.length) element.scrollTop = element.scrollHeight;
	}, [lines]);

	return (
		<Stack gap={4}>
			<Group gap="xs">
				{!stream.done && <Loader size={12} />}
				<Text size="xs" c="dimmed">
					{stream.done ? "Finished" : "Running"}
					{stream.truncated ? " · earlier output hidden" : ""}
				</Text>
			</Group>
			{!!stream.lines.length && (
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
					{stream.lines.map((line, index) => (
						<Text
							// biome-ignore lint/suspicious/noArrayIndexKey: lines stay in order
							key={index}
							ff="monospace"
							size="xs"
							c={line.stream === "stderr" ? "red" : undefined}
							style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}
						>
							{line.value || " "}
						</Text>
					))}
				</Box>
			)}
		</Stack>
	);
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

		const { contents } = useToolDisplayContents({
			message,
			part,
			display,
		});

		const { stream } = useToolStream({ message, part });

		// Nothing can be sent twice: the controls stay locked from the moment
		// feedback is sent until the result it produces has been saved.
		const locked = sendToolFeedback.isPending || display.result !== "pending";

		const [inputValue, setInputValue] = useState<unknown>(part.result?.value);
		const [appendValue, setAppendValue] = useState<Extract<
			zDataBasicPart,
			{ type: "text" }
		> | null>();

		const input: ReactNode | undefined = useMemo(() => {
			if (display?.name === "shell_exec" && display.result === "pending") {
				return (
					<Stack gap="xs">
						<Code language="bash" code={display.input.command} />
						{stream && <ToolStream stream={stream} />}
					</Stack>
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
					<Stack gap="xs">
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
							placeholder="..."
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
					</Stack>
				);
			}
		}, [contents.data, inputValue, display, isFocused, locked, stream]);

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
						<Stack gap="xs">
							<Box>{input}</Box>
						</Stack>
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
		!!previous.part.result === !!next.part.result &&
		previous.part.result?.error === next.part.result?.error &&
		previous.part.result?.value === next.part.result?.value &&
		previous.part.result?.append === next.part.result?.append,
);
