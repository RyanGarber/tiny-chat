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
import type { ask_question } from "@tiny-chat/core/src/features/tool/tools/questions/ask_question.ts";
import type { Tool } from "@tiny-chat/core/src/features/tool/types/tool.ts";
import { memo, type ReactNode, useMemo, useState } from "react";
import type { BundledLanguage } from "streamdown";
import type { z } from "zod";
import type {
	MessageState,
	zDataPart,
} from "#core/features/data/types/message";
import { Code, Diff } from "#ui/core/components/Components.tsx";
import { StyleUtils } from "#ui/core/utils/StyleUtils.ts";
import { Markdown } from "#ui/features/message/components/Markdown.tsx";

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
		tool?: Tool<any, any>;
	}) => {
		const { sendToolInput } = useToolInput();

		const { input: display, contents } = useToolCallInput({
			message,
			toolCall,
			toolResult,
		});

		const [inputValue, setInputValue] = useState<unknown>(toolResult?.value);

		const disabled = toolResult !== undefined;

		const details = display?.details;

		const input: ReactNode | undefined = useMemo(() => {
			if (details?.kind === "shell_exec") {
				return <Code language="bash" code={details.command} />;
			} else if (details?.kind === "write_file") {
				return (
					<Diff
						filename={details.name}
						language={details.extension as BundledLanguage}
						oldCode={contents}
						newCode={details.content}
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
		}, [details, contents, inputValue, disabled]);

		if (tool && input) {
			return (
				<Stack gap="xs" mb={10}>
					<Card withBorder style={{ ...StyleUtils.glass }}>
						<Stack gap="xs">
							<Box>{input}</Box>
						</Stack>
					</Card>
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
									variant="default"
									size="xs"
									onClick={() =>
										sendToolInput.mutate({
											seed: message,
											part: toolCall,
											approved: false,
											value: inputValue,
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

		if (!toolResult) {
			return (
				<Alert color="red" title="Error">
					Tool <code>{tool?.name}</code> can't be used in this context.
				</Alert>
			);
		}
	},
);
