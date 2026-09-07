/** biome-ignore-all lint/suspicious/noArrayIndexKey: parts stay in order */

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
import { CheckIcon } from "@phosphor-icons/react";
import { useMessaging } from "@tiny-chat/client/src/features/chat/hooks/useMessaging.ts";
import { useToolContents } from "@tiny-chat/client/src/features/message/hooks/useToolContents.ts";
import type { RenderedPart } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import type { ask_question } from "@tiny-chat/core/src/features/tool/tools/questions/ask_question.ts";
import type { ToolCallDisplayType } from "@tiny-chat/core/src/features/tool/utils/ToolCallUtils.ts";
import { type ReactNode, useState } from "react";
import type { z } from "zod";
import Code from "#app/features/code/components/Code.tsx";
import Diff from "#app/features/code/components/Diff.tsx";
import Markdown from "#app/features/message/components/Markdown.tsx";
import type { MessageState } from "#core/features/data/types/message";

export default function ToolFeedback({
	message,
	part,
	display,
	isFocused,
}: {
	message: MessageState;
	part: Extract<RenderedPart, { type: "toolCall" }>;
	display: ToolCallDisplayType;
	isFocused?: boolean;
}) {
	const { sendToolFeedback } = useMessaging();

	const { contents } = useToolContents({
		message,
		part,
		display,
	});

	// Nothing can be sent twice: the controls stay locked from the moment
	// feedback is sent until the result it produces has been saved.
	const locked = sendToolFeedback.isPending || display.result !== "pending";

	const [inputValue, setInputValue] = useState<unknown>(
		part.result?.output ?? display.feedbackDefault,
	);

	let input: ReactNode | undefined;
	if (display?.name === "shell_exec" && display.result === "pending") {
		input = <Code language="bash" code={display.input.command} />;
	} else if (
		(display?.name === "write_file" || display?.name === "edit_file") &&
		display.result === "pending"
	) {
		input = (
			<Diff
				filename={display.language}
				language={display.language}
				before={contents.data?.fileBefore ?? ""}
				after={contents.data?.fileAfter ?? ""}
			/>
		);
	} else if (display?.name === "ask_question") {
		input = (
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
	}

	if (input) {
		return (
			<Stack gap="xs" mb={10}>
				<Card withBorder>
					<Stack gap="xs">{input}</Stack>
				</Card>
				<Group gap="xs" justify="flex-end">
					{display?.approval ? (
						<Group gap="xs">
							<Button
								size="xs"
								onClick={() =>
									sendToolFeedback.mutate({
										seed: message,
										part,
										approved: true,
										feedback: inputValue,
									})
								}
								leftSection={display.approval === "approved" && <CheckIcon />}
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
										feedback: inputValue,
									})
								}
								leftSection={display.approval === "rejected" && <CheckIcon />}
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
									feedback: inputValue,
								})
							}
							leftSection={display.result !== "pending" && <CheckIcon />}
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
	}
}
