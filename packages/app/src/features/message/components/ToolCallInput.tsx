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
import { FileTypeUtils } from "@tiny-chat/core/src/features/file/utils/FileTypeUtils.ts";
import { FileUtils } from "@tiny-chat/core/src/features/file/utils/FileUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { ask_question } from "@tiny-chat/core/src/features/tool/tools/questions/ask_question.ts";
import { shell_exec } from "@tiny-chat/core/src/features/tool/tools/shell/shell_exec.ts";
import { write_file } from "@tiny-chat/core/src/features/tool/tools/shell/write_file.ts";
import type { Tool } from "@tiny-chat/core/src/features/tool/types/tool.ts";
import { memo, type ReactNode, useEffect, useMemo, useState } from "react";
import type { BundledLanguage } from "streamdown";
import type { z } from "zod";
import type {
	MessageState,
	zDataPart,
} from "#core/features/data/types/message";
import { client } from "#ui/client.ts";
import { Code, Diff } from "#ui/core/components/Components.tsx";
import { StyleUtils } from "#ui/core/utils/StyleUtils.ts";
import { Markdown } from "#ui/features/message/components/Markdown.tsx";
import { TauriUtils } from "#ui/features/tauri/utils/TauriUtils.ts";
import { toolCallRejection, useToolInput } from "../hooks/useToolInput";

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

		const [inputValue, setInputValue] = useState<unknown>(toolResult?.value);
		const [writeFileContents, setWriteFileContents] = useState<string>("");

		useEffect(() => {
			if (tool?.name === write_file.name) {
				const write = toolCall.args as z.infer<typeof write_file.input>;
				const uri = PathUtils.fromMount(write);
				if (uri) {
					client.api.file.getFile
						.query({ chat: message.chatId, path: uri.path })
						.then((file) => {
							setWriteFileContents(
								file ? (FileUtils.getTextFromBytes(file) ?? "") : "",
							);
						})
						.catch((error) => {
							console.error("Error loading file", error);
							setWriteFileContents("");
						});
				} else {
					TauriUtils.invoke<{ path: string; data: string }>("read_file", {
						path: write.path,
					})
						.then(({ path, data }) => {
							FileTypeUtils.getMime({
								path,
								data,
								fallback: "text/plain",
							})
								.then((mime) => {
									setWriteFileContents(
										FileUtils.getTextFromBytes({ data, mime }) ?? "",
									);
								})
								.catch((error) => {
									console.error("error getting file type:", error);
									setWriteFileContents("");
								});
						})
						.catch((error) => {
							console.error("error reading file:", error);
							setWriteFileContents("");
						});
				}
			}
		}, [tool?.name, toolCall.args, message.chatId]);

		const disabled = toolResult !== undefined;

		const input: ReactNode | undefined = useMemo(() => {
			if (tool?.name === shell_exec.name && !toolResult) {
				return (
					<Code
						language="bash"
						code={(toolCall.args as z.infer<typeof shell_exec.input>).command}
					/>
				);
			} else if (tool?.name === write_file.name && !toolResult) {
				const args = toolCall.args as z.infer<typeof write_file.input>;
				return (
					<Diff
						filename={PathUtils.name(args)}
						language={FileTypeUtils.getExtension(args) as BundledLanguage}
						oldCode={writeFileContents}
						newCode={args.content}
					/>
				);
			} else if (tool?.name === ask_question.name) {
				return (
					<Stack gap="xs">
						<Box>
							<Markdown
								source={
									(toolCall.args as z.infer<typeof ask_question.input>).question
								}
							/>
						</Box>
						<Grid grow>
							{(
								toolCall.args as z.infer<typeof ask_question.input>
							).suggestions.map((suggestion) => (
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
		}, [
			tool?.name,
			toolCall.args,
			toolResult,
			writeFileContents,
			inputValue,
			disabled,
		]);

		if (tool && input) {
			return (
				<Stack gap="xs" mb={10}>
					<Card withBorder style={{ ...StyleUtils.glass }}>
						<Stack gap="xs">
							<Box>{input}</Box>
						</Stack>
					</Card>
					<Group gap="xs" justify="flex-end">
						{tool.approval ? (
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
										toolResult?.error &&
										JSON.stringify(toolResult.value) ===
											JSON.stringify(toolCallRejection) ? (
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
