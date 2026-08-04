import { Icon } from "@iconify/react";
import {
	Alert,
	Box,
	Button,
	Card,
	Grid,
	Group,
	Radio,
	Stack,
	Text,
	Textarea,
} from "@mantine/core";
import { useToolCallInput } from "@tiny-chat/client/src/features/chat/hooks/useToolCallInput.ts";
import {
	toolCallRejection,
	useToolInput,
} from "@tiny-chat/client/src/features/chat/hooks/useToolInput.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import type { ask_question } from "@tiny-chat/core/src/features/tool/tools/questions/ask_question.ts";
import type { Tool } from "@tiny-chat/core/src/features/tool/types/tool.ts";
import { memo, type ReactNode, useMemo, useState } from "react";
import type { BundledLanguage } from "streamdown";
import type { z } from "zod";
import { Code, Diff } from "#app/core/components/Components.tsx";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";
import { Markdown } from "#app/features/message/components/Markdown.tsx";
import type {
	MessageState,
	zDataBasicPart,
	zDataPart,
} from "#core/features/data/types/message";

export const ToolCallInput = memo(
	({
		message,
		toolCall,
		toolResult,
		tool,
	}: {
		message: MessageState;
		toolCall: Extract<zDataPart, { type: "toolCall" }>;
		toolResult?: Extract<zDataPart, { type: "toolResult" }>;
		containerWidth: number;
		tool?: Tool<any, any> | null;
	}) => {
		const { sendToolInput } = useToolInput();

		const {
			input: display,
			contents,
			edited,
		} = useToolCallInput({
			message,
			toolCall,
			toolResult,
		});

		const [inputValue, setInputValue] = useState<unknown>(toolResult?.value);
		const [appendValue, setAppendValue] = useState<Extract<
			zDataBasicPart,
			{ type: "text" }
		> | null>();

		const followUp = (
			<Box
				style={{ borderLeft: "2px solid var(--tc-interior)" }}
				pl={15}
				ml={7.5}
			>
				<Textarea
					autosize
					disabled={!!toolResult}
					placeholder="Add follow-up..."
					value={
						toolResult?.append
							? DataUtils.getText({ data: [toolResult.append] })
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

		const disabled = toolResult !== undefined;

		const details = display?.details;

		const input: ReactNode | undefined = useMemo(() => {
			if (details?.kind === "shell_exec" && display?.pending) {
				return <Code language="bash" code={details.command} />;
			} else if (details?.kind === "write_file" && display?.pending) {
				return (
					<Diff
						filename={details.name}
						language={details.extension as BundledLanguage}
						before={contents}
						after={details.content}
					/>
				);
			} else if (details?.kind === "edit_file" && display?.pending) {
				return (
					<Diff
						filename={details.name}
						language={details.extension as BundledLanguage}
						before={contents}
						after={edited}
					/>
				);
			} else if (details?.kind === "ask_question") {
				return (
					<Stack gap="xs">
						<Box>
							<Markdown source={details.question} />
						</Box>
						<Grid grow>
							{details.suggestions.map((suggestion) => (
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
										disabled={disabled}
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
							disabled={disabled}
							onChange={(e) =>
								setInputValue({
									answer: e.target.value,
								} satisfies z.infer<NonNullable<typeof ask_question.feedback>>)
							}
						/>
					</Stack>
				);
			}
		}, [details, contents, edited, inputValue, disabled, display?.pending]);

		if (tool && input) {
			return (
				<Stack gap="xs" mb={10}>
					<Card withBorder style={{ ...StyleUtils.glass }}>
						<Stack gap="xs">
							<Box>{input}</Box>
						</Stack>
					</Card>
					{followUp}
					<Group gap="xs" justify="flex-end">
						{display?.approval ? (
							<Group gap="xs">
								<Button
									size="xs"
									onClick={() =>
										sendToolInput.mutate({
											seed: message,
											part: toolCall,
											approved: true,
											value: inputValue,
											append: appendValue,
										})
									}
									leftSection={
										JSON.stringify(toolResult?.value) !==
										JSON.stringify(toolCallRejection) ? (
											<Icon icon="lucide:check" />
										) : undefined
									}
									loading={
										sendToolInput.isPending &&
										sendToolInput.variables?.approved === true
									}
									disabled={sendToolInput.isPending || disabled}
								>
									Approve
								</Button>
								<Button
									size="xs"
									variant="default"
									onClick={() =>
										sendToolInput.mutate({
											seed: message,
											part: toolCall,
											approved: false,
											value: inputValue,
											append: appendValue,
										})
									}
									leftSection={
										toolResult?.error && display.rejected ? (
											<Icon icon="lucide:check" />
										) : undefined
									}
									loading={
										sendToolInput.isPending &&
										sendToolInput.variables?.approved === false
									}
									disabled={sendToolInput.isPending || toolResult !== undefined}
								>
									Deny
								</Button>
							</Group>
						) : (
							<Button
								size="xs"
								variant="filled"
								onClick={() =>
									sendToolInput.mutate({
										seed: message,
										part: toolCall,
										value: inputValue,
										append: appendValue,
									})
								}
								leftSection={
									toolResult !== undefined ? (
										<Icon icon="lucide:check" />
									) : undefined
								}
								loading={sendToolInput.isPending}
								disabled={sendToolInput.isPending || toolResult !== undefined}
							>
								Continue
							</Button>
						)}
					</Group>
				</Stack>
			);
		}

		if (toolResult) {
			return !!toolResult.append?.length && followUp;
		} else {
			return (
				<Alert color="red" title="Error">
					Tool <code>{tool?.name}</code> can't be used in this context.
				</Alert>
			);
		}
	},
);
