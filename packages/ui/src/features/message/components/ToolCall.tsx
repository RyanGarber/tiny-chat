import { JsonTree } from "@gfazioli/mantine-json-tree";
import { Icon } from "@iconify/react";
import {
	Anchor,
	Box,
	Collapse,
	Group,
	Image,
	Stack,
	Text,
} from "@mantine/core";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { FileTypeUtils } from "@tiny-chat/core/src/features/file/utils/FileTypeUtils.ts";
import { FileUtils } from "@tiny-chat/core/src/features/file/utils/FileUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { create_action } from "@tiny-chat/core/src/features/tool/tools/actions/create_action.ts";
import { delete_action } from "@tiny-chat/core/src/features/tool/tools/actions/delete_action.ts";
import { list_actions } from "@tiny-chat/core/src/features/tool/tools/actions/list_actions.ts";
import { update_action } from "@tiny-chat/core/src/features/tool/tools/actions/update_action.ts";
import { create_memory } from "@tiny-chat/core/src/features/tool/tools/memories/create_memory.ts";
import { delete_memory } from "@tiny-chat/core/src/features/tool/tools/memories/delete_memory.ts";
import { search_chats } from "@tiny-chat/core/src/features/tool/tools/memories/search_chats.ts";
import { search_memories } from "@tiny-chat/core/src/features/tool/tools/memories/search_memories.ts";
import { update_memory } from "@tiny-chat/core/src/features/tool/tools/memories/update_memory.ts";
import { ask_question } from "@tiny-chat/core/src/features/tool/tools/questions/ask_question.ts";
import { read_dir } from "@tiny-chat/core/src/features/tool/tools/shell/read_dir.ts";
import { read_file } from "@tiny-chat/core/src/features/tool/tools/shell/read_file.ts";
import { search_files } from "@tiny-chat/core/src/features/tool/tools/shell/search_files.ts";
import { shell_exec } from "@tiny-chat/core/src/features/tool/tools/shell/shell_exec.ts";
import { write_file } from "@tiny-chat/core/src/features/tool/tools/shell/write_file.ts";
import { search_web } from "@tiny-chat/core/src/features/tool/tools/web/search_web.ts";
import { view_web } from "@tiny-chat/core/src/features/tool/tools/web/view_web.ts";
import { ToolUtils } from "@tiny-chat/core/src/features/tool/utils/ToolUtils.ts";
import { memo, type ReactNode, useState } from "react";
import type { BundledLanguage } from "streamdown";
import { format } from "timeago.js";
import type { z } from "zod";
import type { zDataPart } from "#core/features/data/types/message";
import { Code } from "#ui/core/components/Components.tsx";
import { useActions } from "#ui/features/chat/hooks/useActions.ts";
import { useTools } from "#ui/features/config/hooks/useTools.ts";
import { TauriUtils } from "#ui/features/tauri/utils/TauriUtils.ts";
import { theme } from "#ui/utils/icon.ts";
import { ChatService } from "../../../../../react/src/features/chat/services/ChatService.ts";

const FZ = "14px";

export const ToolCall = memo(
	({
		toolCall,
		toolResult,
	}: {
		toolCall: Extract<zDataPart, { type: "toolCall" }>;
		toolResult?: Extract<zDataPart, { type: "toolResult" }>;
	}) => {
		const { actions } = useActions();
		const { toolsets } = useTools();

		const [expanded, setExpanded] = useState(false);

		let status: ReactNode;
		let details: ReactNode;

		const { tool } = ToolUtils.find({ toolsets, name: toolCall.name });

		if (tool?.name === search_web.name) {
			status = (
				<>
					{!toolResult ? "Searching" : "Searched"} web for{" "}
					<span style={{ fontWeight: 500 }}>
						{(toolCall.args as z.infer<typeof search_web.input>).query}
					</span>
					{!toolResult ? "..." : ""}
				</>
			);
			if (toolResult?.value?.[0].type === "json") {
				details = (
					<Stack>
						{(
							toolResult.value[0].value as z.infer<typeof search_web.output>
						).map((result) => (
							<Box key={result.url}>
								{result.title && (
									<Text fw={500} fz={FZ}>
										{result.title}
									</Text>
								)}
								<Anchor
									truncate="end"
									href={result.url}
									target="_blank"
									style={{
										display: "block",
									}}
									onClick={(e) => {
										e.preventDefault();
										void TauriUtils.open(result.url);
									}}
								>
									{result.url}
								</Anchor>
								<Text truncate="end" fz={FZ}>
									{result.content}
								</Text>
							</Box>
						))}
					</Stack>
				);
			}
		} else if (tool?.name === view_web.name) {
			status = (
				<>
					{!toolResult ? "Viewing" : "Viewed"}{" "}
					<span style={{ fontWeight: 500 }}>
						{(toolCall.args as z.infer<typeof view_web.input>).url}
					</span>
					{!toolResult ? "..." : ""}
				</>
			);
			if (toolResult?.value?.[0].type === "json") {
				const output = toolResult.value[0].value as z.infer<
					typeof view_web.output
				>;
				details = (
					<Stack>
						{output.title && (
							<Text fw={500} fz={FZ}>
								{output.title}
							</Text>
						)}
						<Anchor
							fw={500}
							fz={FZ}
							target="_blank"
							href={output.url}
							onClick={(e) => {
								e.preventDefault();
								void TauriUtils.open(output.url);
							}}
						>
							{output.url}
						</Anchor>
						<Code
							language="markdown"
							code={output.content}
							lineNumbers={false}
						/>
					</Stack>
				);
			}
		} else if (
			tool?.name === create_action.name ||
			tool?.name === update_action.name ||
			tool?.name === delete_action.name
		) {
			status = (
				<>
					{tool.name === delete_action.name
						? !toolResult
							? "Canceling"
							: "Canceled"
						: !toolResult
							? "Scheduling"
							: "Scheduled"}{" "}
					action{" "}
					<span style={{ fontWeight: 500 }}>
						{DataUtils.getTextCleaned({
							data:
								(
									toolCall.args as
										| z.infer<typeof create_action.input>
										| z.infer<typeof update_action.input>
								).prompt ??
								(toolCall.args as z.infer<typeof delete_action.input>).reason,
						})}
					</span>
					{!toolResult ? "..." : ""}
				</>
			);
			if (toolResult?.value?.[0].type === "json") {
				details = (
					<Text fz={FZ}>
						{tool.name === create_action.name
							? `Created action with ID: ${(toolResult.value[0].value as z.infer<typeof create_action.output>).created_action_id}.`
							: tool.name === update_action.name
								? `Updated action with ID: ${(toolResult.value[0].value as z.infer<typeof update_action.output>).updated_action_id}.`
								: tool.name === delete_action.name
									? `Removed action with ID: ${(toolResult.value[0].value as z.infer<typeof delete_action.output>).deleted_action_id}.`
									: ""}
					</Text>
				);
			}
		} else if (tool?.name === list_actions.name) {
			status = (
				<>
					{!toolResult ? "Checking" : "Checked"} scheduled actions
					{!toolResult ? "..." : ""}
				</>
			);
			if (toolResult?.value?.[0].type === "json") {
				details = (
					<Stack>
						{(
							toolResult.value[0].value as z.infer<typeof list_actions.output>
						).map((action) => {
							const nextRunAt = actions.data?.find(
								(a) => a.id === action.id,
							)?.nextRunAt;
							return (
								<Box key={action.id}>
									<Text fw={500} fz={FZ}>
										{action.prompt}
									</Text>
									<Anchor
										truncate="end"
										href={`/#/${action.chat_id}`}
										target="_blank"
										style={{
											display: "block",
										}}
										onClick={(e) => {
											e.preventDefault();
											ChatService.setChatId(action.chat_id);
										}}
									>
										Go to chat
									</Anchor>
									{nextRunAt && (
										<Text truncate="end" fz={FZ}>
											{format(nextRunAt)}
										</Text>
									)}
								</Box>
							);
						})}
					</Stack>
				);
			}
		} else if (tool?.name === search_chats.name) {
			status = (
				<>
					{!toolResult ? "Searching" : "Searched"} chats for{" "}
					<span style={{ fontWeight: 500 }}>
						{(toolCall.args as z.infer<typeof search_chats.input>).query}
					</span>
					{!toolResult ? "..." : ""}
				</>
			);
			if (toolResult?.value?.[0].type === "json") {
				details = (
					<Stack>
						{(
							toolResult.value[0].value as z.infer<typeof search_chats.output>
						).map((result) => (
							<Box key={result.snippet}>
								<Text fw={500} fz={FZ}>
									{result.chat_title}
								</Text>
								<Text truncate="end" fz={FZ}>
									{result.snippet}
								</Text>
							</Box>
						))}
					</Stack>
				);
			}
		} else if (
			tool?.name === create_memory.name ||
			tool?.name === update_memory.name ||
			tool?.name === delete_memory.name
		) {
			status = (
				<>
					{!toolResult ? "Remembering..." : "Remembered"}{" "}
					<span style={{ fontWeight: 500 }}>
						{(
							toolCall.args as
								| z.infer<typeof create_memory.input>
								| z.infer<typeof update_memory.input>
						).fact ??
							(toolCall.args as z.infer<typeof delete_memory.input>).reason}
					</span>
					{!toolResult ? "..." : ""}
				</>
			);
			if (toolResult?.value?.[0].type === "json") {
				details = (
					<Text fz={FZ}>
						{tool.name === create_memory.name
							? `Created memory with ID: ${(toolResult.value[0].value as z.infer<typeof create_memory.output>).created_memory_id}.`
							: tool.name === update_memory.name
								? `Updated memory with ID: ${(toolResult.value[0].value as z.infer<typeof update_memory.output>).updated_memory_id}.`
								: tool.name === delete_memory.name
									? `Removed memory with ID: ${(toolResult.value[0].value as z.infer<typeof delete_memory.output>).deleted_memory_id}.`
									: ""}
					</Text>
				);
			}
		} else if (tool?.name === search_memories.name) {
			status = (
				<>
					{!toolResult ? "Searching" : "Searched"} memories for{" "}
					<span style={{ fontWeight: 500 }}>
						{(toolCall.args as z.infer<typeof search_memories.input>).query}
					</span>
					{!toolResult ? "..." : ""}
				</>
			);
			if (toolResult?.value?.[0].type === "json") {
				details = (
					<Stack>
						{(
							toolResult.value[0].value as z.infer<
								typeof search_memories.output
							>
						).map((result) => (
							<Stack key={result.fact} gap={0}>
								<Text fz={FZ}>{result.fact}</Text>
								<Text size="xs" c="dimmed">
									(learned {format(result.created_at)})
								</Text>
							</Stack>
						))}
					</Stack>
				);
			}
		} else if (tool?.name === read_file.name && toolCall.args?.path) {
			// TODO WIP - avoid mcp name conflicts
			status = (
				<>
					{!toolResult ? "Reading" : "Read"} file{" "}
					<span style={{ fontWeight: 500 }}>
						{PathUtils.name(toolCall.args as z.infer<typeof read_file.input>)}
					</span>
					{!toolResult ? "..." : ""}
				</>
			);
			if (toolResult?.value?.[0].type === "file") {
				let content: ReactNode;
				if (toolResult?.value[0].mime.startsWith("image/")) {
					const uri = `data:${toolResult?.value[0].mime};base64,${toolResult?.value[0].data}`;
					content = <Image src={uri} />;
				} else {
					const text = FileUtils.getTextFromBytes(toolResult?.value[0]);
					content = (
						<Code
							filename={toolResult?.value[0].name}
							language={
								FileTypeUtils.getExtension(
									toolResult?.value[0],
								) as BundledLanguage
							}
							code={text ?? "// failed to decode file"}
						/>
					);
				}
				if (content) {
					details = (
						<Stack>
							<Text fw={500} fz={FZ}>
								{(toolCall.args as z.infer<typeof read_file.input>).path}
							</Text>
							{content}
						</Stack>
					);
				}
			}
		} else if (tool?.name === write_file.name) {
			status = (
				<>
					{!toolResult ? "Writing" : "Wrote"} file{" "}
					<span style={{ fontWeight: 500 }}>
						{PathUtils.name(toolCall.args as z.infer<typeof write_file.input>)}
					</span>
					{!toolResult ? "..." : ""}
				</>
			);
			if (toolResult?.value[0]?.type === "json") {
				const input = toolCall.args as z.infer<typeof write_file.input>;
				details = (
					<Stack>
						<Text fw={500} fz={FZ}>
							{input.path}
						</Text>
						<Code
							filename={PathUtils.name(input)}
							language={FileTypeUtils.getExtension(input) as BundledLanguage}
							code={input.content}
						/>
					</Stack>
				);
			}
		} else if (tool?.name === read_dir.name) {
			status = (
				<>
					{!toolResult ? "Looking" : "Looked"} in folder{" "}
					<span style={{ fontWeight: 500 }}>
						{PathUtils.name(toolCall.args as z.infer<typeof read_dir.input>)}
					</span>
					{!toolResult ? "..." : ""}
				</>
			);
			if (toolResult?.value[0].type === "json") {
				const output = toolResult?.value[0].value as z.infer<
					typeof read_dir.output
				>;
				details = (
					<Stack>
						<Group gap="xs">
							<Text fw={500} fz={FZ}>
								{(toolCall.args as z.infer<typeof read_dir.input>).path}
							</Text>
							<Text c="dimmed" fz={FZ}>
								{output.length} item{output.length === 1 ? "" : "s"}
							</Text>
						</Group>
						{output.map((item) => {
							const iconId = !item.is_dir
								? theme?.getFileIconId(item.path, undefined, false)
								: theme?.getFolderIconId(item.path, false, false);
							const icon = iconId
								? theme?.getIconContent(iconId, "base64")
								: null;

							return (
								<Group key={PathUtils.name(item)} gap={5} miw={0}>
									{icon && (
										<Image
											w="auto"
											h={20}
											src={`data:${icon.mimeType};base64,${icon.data}`}
										/>
									)}
									<Text truncate="end" fz={FZ}>
										{PathUtils.name(item)}
										{item.is_dir ? "/" : ""}
									</Text>
								</Group>
							);
						})}
					</Stack>
				);
			}
		} else if (tool?.name === search_files.name) {
			status = (
				<>
					{!toolResult ? "Searching" : "Searched"} files for{" "}
					<span style={{ fontWeight: 500 }}>
						{(toolCall.args as z.infer<typeof search_files.input>).query}
					</span>
					{!toolResult ? "..." : ""}
				</>
			);
			if (toolResult?.value?.[0].type === "json") {
				details = (
					<Stack>
						{(
							toolResult.value[0].value as z.infer<typeof search_files.output>
						).map((upload) => (
							<Box key={PathUtils.name(upload)}>
								<Text fw={500} fz={FZ}>
									{upload.path}
								</Text>
								<Text truncate="end" fz={FZ}>
									{upload.snippet}
								</Text>
							</Box>
						))}
					</Stack>
				);
			}
		} else if (tool?.name === ask_question.name) {
			status = !toolResult ? "Asking a question..." : "Asked a question";
		} else if (tool?.name === shell_exec.name) {
			status = (
				<>
					{!toolResult ? "Running" : "Ran"}{" "}
					<span style={{ fontWeight: 500 }}>
						{
							(toolCall.args as z.infer<typeof shell_exec.input>).command.split(
								" ",
							)[0]
						}
					</span>
					{!toolResult ? "..." : ""}
				</>
			);
			if (toolResult?.value[0]?.type === "json") {
				const { stdout, stderr } = toolResult.value[0].value as z.infer<
					typeof shell_exec.output
				>;
				const output = [
					stdout ? `# stdout\n${stdout.trim()}` : "",
					stderr ? `# stderr\n${stderr.trim()}` : "",
				].filter(Boolean);
				details = (
					<Code
						language="bash"
						code={`# stdin\n${(toolCall.args as z.infer<typeof shell_exec.input>).command.trim()}\n\n${output.join("\n\n")}`}
					/>
				);
			}
		}

		return (
			<Box my={10}>
				<Group
					className={`shimmer-text ${!toolResult ? "active" : ""}`}
					onClick={() => setExpanded(!expanded)}
					style={{ cursor: "pointer" }}
					gap="xs"
					wrap="nowrap"
				>
					<Icon
						icon="lucide:wrench"
						height={18}
						style={{ minWidth: 18 }}
						color="var(--mantine-color-dimmed)"
					/>
					<Text
						truncate="end"
						fz={FZ}
						c={toolResult?.error ? "red" : undefined}
					>
						{status ?? (
							<>
								{!toolResult ? "Using" : "Used"}{" "}
								<span style={{ fontWeight: 500 }}>{toolCall.name}</span>
								{!toolResult ? "..." : ""}
							</>
						)}
					</Text>
				</Group>
				<Collapse expanded={expanded}>
					{expanded && (
						<Box
							style={{
								borderLeft: "2px solid var(--mantine-color-default-border)",
							}}
							px="lg"
							py="xs"
							ml={8}
						>
							{details ?? (
								<Stack>
									<Text fz={FZ}>Input</Text>
									<JsonTree
										data={toolCall.args as unknown}
										withExpandAll
										withCopyToClipboard
									/>
									<Text fz={FZ}>Output</Text>
									<JsonTree
										data={toolResult?.value}
										withExpandAll
										withCopyToClipboard
									/>
								</Stack>
							)}
						</Box>
					)}
				</Collapse>
			</Box>
		);
	},
);
