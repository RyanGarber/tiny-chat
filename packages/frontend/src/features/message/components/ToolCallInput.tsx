import { Icon } from "@iconify/react";
import {
	Alert,
	Box,
	Button,
	Card,
	ColorInput,
	Grid,
	Group,
	NumberInput,
	Radio,
	Stack,
	Text,
	Textarea,
} from "@mantine/core";
import { DatePicker, DateTimePicker, TimePicker } from "@mantine/dates";
import { memo, type ReactNode, useEffect, useMemo, useState } from "react";
import type { BundledLanguage } from "streamdown";
import type { z } from "zod";
import { Code, Diff } from "#frontend/core/components/Components.tsx";
import { Markdown } from "#frontend/features/message/components/Markdown.tsx";
import { invoke, trpc } from "#frontend/utils/api.ts";
import { GLASS_STYLE } from "#frontend/utils/theme.ts";
import type {
	zReplyColorInput,
	zReplyColorOutput,
	zReplyDatetimeInput,
	zReplyDatetimeOutput,
	zReplyNumberInput,
	zReplyNumberOutput,
	zReplyQuestionInput,
	zReplyQuestionOutput,
} from "#shared/tools/questions.ts";
import { type zShellExecInput, zWriteFileInput } from "#shared/tools/system.ts";
import type { MessageState, zDataPart } from "#shared/types/chat.ts";
import type { Tool } from "#shared/types/tool.ts";
import {
	decodeTextLossy,
	fromChatUri,
	mimeExtension,
	mimeType,
	mimeTypeFromExtension,
	pathName,
} from "#shared/utils/files.ts";
import { toolCallRejection, useToolInput } from "../hooks/useToolInput";

export const ToolCallInput = memo(
	({
		message,
		part,
		result,
		tool,
	}: {
		message: MessageState;
		part: Extract<zDataPart, { type: "toolCall" }>;
		result?: Extract<zDataPart, { type: "toolResult" }>;
		containerWidth: number;
		tool?: Tool<z.ZodAny, z.ZodAny, z.ZodAny>;
	}) => {
		const { sendToolInput } = useToolInput();

		const [inputValue, setInputValue] = useState<unknown>(result?.value);

		const [writeFileContents, setWriteFileContents] = useState<string>("");

		useEffect(() => {
			if (part.name === "write_file") {
				const write = zWriteFileInput.parse(part.args);
				const uri = fromChatUri(write.path);
				if (uri) {
					trpc.input.findFileInChat
						.query({
							chatId: message.chatId,
							uploadId: uri.uploadId ?? null,
							path: uri.path,
						})
						.then((file) => {
							setWriteFileContents(
								file ? (decodeTextLossy(file.data, file.mime) ?? "") : "",
							);
						})
						.catch((error) => {
							console.error("Error loading file", error);
							setWriteFileContents("");
						});
				} else {
					console.log(`calling read_file ${write.path}`);
					invoke<string>("read_file", { path: write.path })
						.then((contents) => {
							console.log(`contents:`, contents);
							mimeType(contents, pathName(write.path), "text/plain")
								.then((mime) => {
									console.log(`mime: ${mime}`);
									setWriteFileContents(decodeTextLossy(contents, mime) ?? "");
								})
								.catch((error) => {
									console.error("Error getting mime type of file", error);
									setWriteFileContents("");
								});
						})
						.catch((error) => {
							console.error("Error reading file", error);
							setWriteFileContents("");
						});
				}
			}
		}, [part.name, part.args, message.chatId]);

		const disabled = result !== undefined;

		const input: ReactNode | undefined = useMemo(() => {
			if (part.name === "shell_exec" && !result) {
				return (
					<Code language="bash" code={(part.args as zShellExecInput).command} />
				);
			} else if (part.name === "write_file" && !result) {
				const args = part.args as zWriteFileInput;
				return (
					<Diff
						filename={pathName(args.path)}
						language={
							mimeExtension(
								mimeTypeFromExtension(args.path),
								args.path,
							) as BundledLanguage
						}
						oldCode={writeFileContents}
						newCode={args.content}
					/>
				);
			} else if (part.name === "reply_question") {
				return (
					<Stack gap="xs">
						<Box>
							<Markdown source={(part.args as zReplyQuestionInput).question} />
						</Box>
						<Grid grow>
							{(part.args as zReplyQuestionInput).suggestions.map(
								(suggestion) => (
									<Grid.Col key={suggestion} span={4} align="stretch">
										<Radio.Card
											p="md"
											h="100%"
											checked={
												(inputValue as zReplyQuestionOutput | undefined)
													?.answer === suggestion
											}
											disabled={disabled}
											defaultChecked={
												(inputValue as zReplyQuestionOutput | undefined)
													?.answer === suggestion
											}
											onClick={() =>
												setInputValue({
													answer: suggestion,
												} satisfies zReplyQuestionOutput)
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
								),
							)}
						</Grid>
						<Textarea
							autosize
							minRows={1}
							maxRows={10}
							placeholder="..."
							value={(inputValue as zReplyQuestionOutput | undefined)?.answer}
							disabled={disabled}
							onChange={(e) =>
								setInputValue({
									answer: e.target.value,
								} satisfies zReplyQuestionOutput)
							}
						/>
					</Stack>
				);
			} else if (part.name === "reply_color") {
				return (
					<Stack gap="xs">
						<Text>
							<Markdown source={(part.args as zReplyColorInput).question} />
						</Text>
						<ColorInput
							value={(inputValue as zReplyColorOutput | undefined)?.color}
							defaultValue={
								(inputValue as zReplyColorOutput | undefined)?.color
							}
							placeholder="..."
							disabled={disabled}
							onChange={(v) =>
								setInputValue({
									color: v,
								} satisfies zReplyColorOutput)
							}
						/>
					</Stack>
				);
			} else if (part.name === "reply_number") {
				return (
					<Stack gap="xs">
						<Text>
							<Markdown source={(part.args as zReplyNumberInput).question} />
						</Text>
						<NumberInput
							value={(inputValue as zReplyNumberOutput | undefined)?.number}
							defaultValue={
								(inputValue as zReplyNumberOutput | undefined)?.number
							}
							placeholder="..."
							disabled={disabled}
							onChange={(v) =>
								setInputValue({
									number: Number(v),
								} satisfies zReplyNumberOutput)
							}
						/>
					</Stack>
				);
			} else if (part.name === "reply_datetime") {
				return (
					<Stack gap="xs">
						<Text>
							<Markdown source={(part.args as zReplyDatetimeInput).question} />
						</Text>
						<DateTimePicker
							value={(inputValue as zReplyDatetimeOutput | undefined)?.date}
							defaultValue={
								(inputValue as zReplyDatetimeOutput | undefined)?.date
							}
							placeholder="..."
							disabled={disabled}
							onChange={(v) =>
								v &&
								setInputValue({
									date: v.split(" ")[0],
									time: v.split(" ")[1],
								} satisfies zReplyDatetimeOutput)
							}
						/>
					</Stack>
				);
			} else if (part.name === "reply_date") {
				return (
					<Stack gap="xs">
						<Text>
							<Markdown source={(part.args as zReplyDatetimeInput).question} />
						</Text>
						<DatePicker
							value={(inputValue as zReplyDatetimeOutput | undefined)?.date}
							defaultValue={
								(inputValue as zReplyDatetimeOutput | undefined)?.date
							}
							onChange={(v) =>
								setInputValue({
									date: v ?? undefined,
								} satisfies zReplyDatetimeOutput)
							}
						/>
					</Stack>
				);
			} else if (part.name === "reply_time") {
				return (
					<Stack gap="xs">
						<Text>
							<Markdown source={(part.args as zReplyDatetimeInput).question} />
						</Text>
						<TimePicker
							value={(inputValue as zReplyDatetimeOutput | undefined)?.time}
							defaultValue={
								(inputValue as zReplyDatetimeOutput | undefined)?.time
							}
							disabled={disabled}
							onChange={(v) =>
								setInputValue({
									time: v,
								} satisfies zReplyDatetimeOutput)
							}
						/>
					</Stack>
				);
			}
		}, [part.name, part.args, result, writeFileContents, inputValue, disabled]);

		if (tool && input) {
			return (
				<Stack gap="xs" mb={10}>
					<Card withBorder style={{ ...GLASS_STYLE }}>
						<Stack gap="xs">
							<Box>{input}</Box>
						</Stack>
					</Card>
					<Group gap="xs" justify="flex-end">
						{tool.requirements?.approval ? (
							<Group gap="xs">
								<Button
									size="xs"
									onClick={() =>
										sendToolInput.mutate({
											seed: message,
											part,
											approved: true,
											value: inputValue,
										})
									}
									leftSection={
										JSON.stringify(result?.value) !==
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
											part,
											approved: false,
											value: inputValue,
										})
									}
									leftSection={
										result?.error &&
										JSON.stringify(result.value) ===
											JSON.stringify(toolCallRejection) ? (
											<Icon icon="lucide:check" />
										) : undefined
									}
									loading={
										sendToolInput.isPending &&
										sendToolInput.variables?.approved === false
									}
									disabled={sendToolInput.isPending || result !== undefined}
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
										part,
										value: inputValue,
									})
								}
								leftSection={
									result !== undefined ? (
										<Icon icon="lucide:check" />
									) : undefined
								}
								loading={sendToolInput.isPending}
								disabled={sendToolInput.isPending || result !== undefined}
							>
								Continue
							</Button>
						)}
					</Group>
				</Stack>
			);
		}

		if (!result) {
			return (
				<Alert color="red" title="Error">
					Tool <code>{part.name}</code> not recognized Tool{" "}
					<code>{part.name}</code> not found
				</Alert>
			);
		}
	},
);
