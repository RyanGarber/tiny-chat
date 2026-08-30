import { JsonTree } from "@gfazioli/mantine-json-tree";
import { Anchor, Box, Collapse, Group, Stack, Text } from "@mantine/core";
import { WrenchIcon } from "@phosphor-icons/react";
import type {
	AgentStreamEvent,
	ToolStreamEvent,
} from "@tiny-chat/client/src/core/services/StreamService.ts";
import { useStream } from "@tiny-chat/client/src/features/agent/hooks/useStream.ts";
import { ChatService } from "@tiny-chat/client/src/features/chat/services/ChatService.ts";
import type { StreamState } from "@tiny-chat/core/src/core/types/stream.ts";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import type { zDataPart } from "@tiny-chat/core/src/features/data/types/message.ts";
import { FileTypeUtils } from "@tiny-chat/core/src/features/file/utils/FileTypeUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import type { shell_exec } from "@tiny-chat/core/src/features/tool/tools/shell/shell_exec.ts";
import type { spawn_subagent } from "@tiny-chat/core/src/features/tool/tools/subagents/spawn_subagent.ts";
import type { ToolCallUtils } from "@tiny-chat/core/src/features/tool/utils/ToolCallUtils.ts";
import { type ReactNode, useState } from "react";
import type { BundledLanguage } from "streamdown";
import Code from "#app/features/code/components/Code.tsx";
import Diff from "#app/features/code/components/Diff.tsx";
import Markdown from "#app/features/message/components/Markdown.tsx";
import MessageParts from "#app/features/message/components/MessageParts.tsx";
import Image from "#app/features/part/components/Image.tsx";
import Quote from "#app/features/part/components/Quote.tsx";
import { TauriUtils } from "#app/features/tauri/utils/TauriUtils.ts";

/**
 * Renders the expanded details content for a tool call.
 * Extracted as a separate component so it only mounts when expanded,
 * avoiding heavy JSX computation (Code, Diff, etc.) for collapsed tool calls.
 */
function ToolCallDetails({
	part,
	details,
}: {
	part: Extract<zDataPart, { type: "toolCall" }>;
	details: ReturnType<typeof ToolCallUtils.getDisplay>;
}) {
	const stream = useStream<ToolStreamEvent<any>>(part.id);

	let detailsNode: ReactNode;

	if (details.name === "search_web" && details.output) {
		detailsNode = details.output.map((result) => (
			<Box key={result.url}>
				{result.title && <Text fw={500}>{result.title}</Text>}
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
				<Text truncate="end">{result.content}</Text>
			</Box>
		));
	} else if (details.name === "view_web" && details.output) {
		detailsNode = (
			<Stack>
				{details.output.title && <Text fw={500}>{details.output.title}</Text>}
				<Anchor
					fw={500}
					target="_blank"
					href={details.output.url}
					onClick={(e) => {
						e.preventDefault();
						void TauriUtils.open(details.output?.url ?? "");
					}}
				>
					{details.output.url}
				</Anchor>
				<Code
					code={details.output.content}
					language="markdown"
					lineNumbers={false}
					streaming={false}
				/>
			</Stack>
		);
	} else if (details.name === "create_action" && details.output) {
		detailsNode = (
			<Text>Created action {details.output.created_action_id}.</Text>
		);
	} else if (details.name === "update_action" && details.output) {
		detailsNode = (
			<Text>Updated action {details.output.updated_action_id}.</Text>
		);
	} else if (details.name === "delete_action" && details.output) {
		detailsNode = (
			<Text>Deleted action {details.output.deleted_action_id}.</Text>
		);
	} else if (details.name === "list_actions" && details.output) {
		detailsNode = details.output.map((action) => (
			<Box key={action.id}>
				<Text fw={500}>{action.prompt}</Text>
				<Anchor
					truncate="end"
					href={`/#/${action.chat_id}`}
					target="_blank"
					display="block"
					onClick={(e) => {
						e.preventDefault();
						ChatService.setChat({ id: action.chat_id });
					}}
				>
					Created{" "}
					{CommonUtils.formatDate({
						date: new Date(action.created_at),
						relative: true,
					})}
					.
				</Anchor>
				{action.next_run_at && (
					<Text truncate="end">
						Next runs{" "}
						{CommonUtils.formatDate({
							date: new Date(action.next_run_at),
							relative: true,
						})}
						.
					</Text>
				)}
			</Box>
		));
	} else if (details.name === "search_chats" && details.output) {
		detailsNode = details.output.map((message) => (
			<Box key={message.id}>
				<Text fw={500}>{message.snippet}</Text>
				<Anchor
					truncate="end"
					href={`/#/${message.chat_id}`}
					target="_blank"
					display="block"
					onClick={(e) => {
						e.preventDefault();
						ChatService.setChat({ id: message.chat_id });
					}}
				>
					Sent{" "}
					{CommonUtils.formatDate({
						date: new Date(message.created_at),
						relative: true,
					})}
					.
				</Anchor>
				<Text truncate="end">{message.snippet}</Text>
			</Box>
		));
	} else if (details.name === "create_memory" && details.output) {
		detailsNode = (
			<Text>Created memory {details.output.created_memory_id}.</Text>
		);
	} else if (details.name === "update_memory" && details.output) {
		detailsNode = (
			<Text>Updated memory {details.output.updated_memory_id}.</Text>
		);
	} else if (details.name === "delete_memory" && details.output) {
		detailsNode = (
			<Text>Deleted memory {details.output.deleted_memory_id}.</Text>
		);
	} else if (details.name === "search_memories" && details.output) {
		detailsNode = details.output.map((result) => (
			<Stack key={result.fact} gap={0}>
				<Text>{result.fact}</Text>
				<Text size="xs" c="dimmed">
					Learned{" "}
					{CommonUtils.formatDate({
						date: new Date(result.created_at),
						relative: true,
					})}
					.
				</Text>
			</Stack>
		));
	} else if (details.name === "read_file" && details.content) {
		detailsNode = (
			<>
				{details.content.type === "image" && (
					<Image
						src={details.content.value}
						filename={details.input.path.split("/").at(-1)}
					/>
				)}
				{details.content.type === "text" && (
					<Code
						code={details.content.value}
						language={
							FileTypeUtils.getExtension({
								name: details.name,
								path: details.input.path,
							}) as BundledLanguage
						}
						filename={details.input.path}
					/>
				)}
			</>
		);
	} else if (details.name === "write_file" && details.output) {
		detailsNode = (
			<Code
				filename={details.output.path}
				language={details.language}
				code={details.input.content}
			/>
		);
	} else if (details.name === "edit_file" && details.output) {
		detailsNode = (
			<Diff
				filename={details.output.path}
				language={details.language}
				before={details.input.old_string}
				after={details.input.new_string}
			/>
		);
	} else if (
		(details.name === "read_dir" || details.name === "find_files") &&
		details.output
	) {
		detailsNode = (
			<Code
				code={details.output
					.map(
						(item) =>
							`${PathUtils.name(item)}${typeof item === "object" && item.is_dir ? "/" : ""}`,
					)
					.join("\n")}
				filename={details.input.path}
				language="text"
			/>
		);
	} else if (
		(details.name === "search_files" || details.name === "grep_files") &&
		details.output
	) {
		detailsNode = details.output.map((file) => (
			<Code key={file.path} filename={file.path} code={file.snippet} />
		));
	} else if (details.name === "shell_exec" && details.content) {
		const _stream = stream as
			| StreamState<ToolStreamEvent<typeof shell_exec>>
			| undefined;
		const streamLines = _stream?.items;

		const streamOutput = streamLines?.map((line) => line.value).join("\n");

		detailsNode = (
			<Code
				code={streamOutput ?? details.content}
				language="bash"
				h={400}
				fillHeight
			/>
		);
	} else if (details.name === "spawn_subagent") {
		const _stream = stream as
			| StreamState<ToolStreamEvent<typeof spawn_subagent>>
			| undefined;
		const streamData = _stream?.items.at(-1);

		const latest = streamData?.at(-1)?.at(-1)?.type;
		const status: AgentStreamEvent["status"] | undefined =
			latest === "text"
				? "generating"
				: latest === "thought"
					? "thinking"
					: undefined;

		detailsNode = (
			<>
				<Quote>
					<Markdown source={details.input.prompt} />
				</Quote>
				{streamData && <MessageParts data={streamData} status={status} />}
				{details.output && <Markdown source={details.output.response} />}
			</>
		);
	}

	return (
		<Box
			style={{
				borderLeft: "2px solid var(--mantine-color-default-border)",
			}}
			px="lg"
			py="xs"
			ml={8}
		>
			<Stack>
				{detailsNode ?? (
					<>
						<Text>Input</Text>
						<JsonTree data={details.input} withExpandAll withCopyToClipboard />
						<Text>Output</Text>
						<JsonTree data={details.output} withExpandAll withCopyToClipboard />
					</>
				)}
			</Stack>
		</Box>
	);
}

export default function ToolCall({
	part,
	display,
}: {
	part: Extract<zDataPart, { type: "toolCall" }>;
	display: ReturnType<typeof ToolCallUtils.getDisplay>;
}) {
	const [expanded, setExpanded] = useState(false);

	return (
		<Box my={10}>
			<Group
				className={`shimmer-text ${display.result === "pending" ? "active" : ""}`}
				onClick={() => setExpanded(!expanded)}
				style={{ cursor: "pointer" }}
				gap="xs"
				wrap="nowrap"
			>
				<WrenchIcon size={20} color="var(--mantine-color-dimmed)" />
				<Text
					truncate="end"
					c={display.result === "error" ? "red" : undefined}
					flex={1}
				>
					{display.status.map((part) =>
						typeof part === "string" ? (
							<span key={part}>{part} </span>
						) : (
							<span key={part.subject} style={{ fontWeight: 500 }}>
								{part.subject}{" "}
							</span>
						),
					)}
				</Text>
			</Group>
			<Collapse expanded={expanded} style={{ zoom: 0.9 }}>
				{expanded && <ToolCallDetails part={part} details={display} />}
			</Collapse>
		</Box>
	);
}
