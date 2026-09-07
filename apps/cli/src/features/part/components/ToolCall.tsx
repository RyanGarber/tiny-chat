import type {
	AgentStreamEvent,
	ToolStreamEvent,
} from "@tiny-chat/client/src/core/services/StreamService.ts";
import { useStream } from "@tiny-chat/client/src/features/agent/hooks/useStream.ts";
import type { StreamState } from "@tiny-chat/core/src/core/types/stream.ts";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import type { MessageState } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { zToolCallPart } from "@tiny-chat/core/src/features/data/types/part.ts";
import type { RenderedPart } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import type { shell_exec } from "@tiny-chat/core/src/features/tool/tools/shell/shell_exec.ts";
import type { spawn_subagent } from "@tiny-chat/core/src/features/tool/tools/subagents/spawn_subagent.ts";
import type {
	ToolCallDisplayType,
	ToolCallUtils,
} from "@tiny-chat/core/src/features/tool/utils/ToolCallUtils.ts";
import chalk from "chalk";
import Image from "ink-picture";
import type { ReactNode } from "react";
import Anchor from "../../../core/components/Anchor.tsx";
import Box from "../../../core/components/Box.tsx";
import Text from "../../../core/components/Text.tsx";
import { Code } from "../../code/components/Code.tsx";
import Diff from "../../code/components/Diff.tsx";
import Markdown from "../../message/components/Markdown.tsx";
import MessageParts from "../../message/components/MessageParts.tsx";
import Quote from "./Quote.tsx";
import Task from "./Task.tsx";
import ToolFeedback from "./ToolFeedback.tsx";

function ToolCallDetails({
	part,
	details,
}: {
	part: zToolCallPart;
	details: ReturnType<typeof ToolCallUtils.getDisplay>;
}) {
	const stream = useStream<ToolStreamEvent<any>>(part.id);

	let detailsNode: ReactNode | undefined;

	if (details.name === "search_web") {
		detailsNode = details.output?.map((result) => (
			<Box key={result.url} flexDirection="column">
				<Text bold>{result.title}</Text>
				<Anchor href={result.url} wrap="truncate-end" />
				<Text wrap="truncate-end">{result.content.replaceAll("\n", "")}</Text>
			</Box>
		));
	} else if (details.name === "view_web" && details.output) {
		detailsNode = (
			<Box flexDirection="column">
				{details.output.title && <Text bold>{details.output.title}</Text>}
				<Anchor href={details.output.url} wrap="truncate-end" />
				<Code
					code={details.output.content}
					language="markdown"
					lineNumbers={false}
				/>
			</Box>
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
			<Box key={action.id} flexDirection="column">
				<Text bold wrap="truncate-end">
					{action.prompt.replaceAll("\n", " ")}
				</Text>
				<Text>
					created{" "}
					{CommonUtils.formatDate({
						date: action.created_at,
						relative: true,
					})}
				</Text>
				{action.next_run_at && (
					<Text color="textSubtle">
						next runs{" "}
						{CommonUtils.formatDate({
							date: action.next_run_at,
							relative: true,
						})}
					</Text>
				)}
			</Box>
		));
	} else if (details.name === "search_chats" && details.output) {
		detailsNode = details.output.map((message) => (
			<Box key={message.id} flexDirection="column">
				<Text bold wrap="truncate-end">
					{message.chat_title ?? "Untitled chat"}
				</Text>
				<Text wrap="truncate-end">{message.snippet.replaceAll("\n", " ")}</Text>
				<Text color="textSubtle">
					sent{" "}
					{CommonUtils.formatDate({
						date: message.created_at,
						relative: true,
					})}
				</Text>
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
		detailsNode = details.output.map((memory) => (
			<Box key={memory.id} flexDirection="column">
				<Text>{memory.fact}</Text>
				<Text color="textSubtle">
					learned{" "}
					{CommonUtils.formatDate({
						date: memory.created_at,
						relative: true,
					})}
				</Text>
			</Box>
		));
	} else if (details.name === "read_file") {
		detailsNode = (
			<>
				{details.content?.type === "image" && (
					<Image src={details.content.value} />
				)}
				{details.content?.type === "text" && (
					<Code
						code={details.content.value}
						language={details.language}
						filename={details.input.path}
					/>
				)}
			</>
		);
	} else if (details.name === "edit_file" && details.output) {
		detailsNode = (
			<Diff
				before={details.input.old_string}
				after={details.input.new_string}
				language={details.language}
				filename={details.output.path}
			/>
		);
	} else if (details.name === "write_file" && details.output) {
		detailsNode = (
			<Code
				code={details.input.content}
				language={details.language}
				filename={details.output.path}
			/>
		);
	} else if (
		(details.name === "read_dir" || details.name === "find_files") &&
		details.output
	) {
		detailsNode = (
			<Code
				language="text"
				code={details.output
					.map(
						(item) =>
							`${PathUtils.name(item)}${typeof item === "object" && item.is_dir ? "/" : ""}`,
					)
					.join("\n")}
				filename={details.input.path}
			/>
		);
	} else if (
		(details.name === "search_files" || details.name === "grep_files") &&
		details.output
	) {
		detailsNode = details.output.map((file) => (
			<Code key={file.path} code={file.snippet} filename={file.path} />
		));
	} else if (details.name === "shell_exec" && details.content) {
		const _stream = stream as
			| StreamState<ToolStreamEvent<typeof shell_exec>>
			| undefined;
		const streamLines = _stream?.items;

		const streamOutput = streamLines?.map((line) => line.value).join("\n");

		detailsNode = (
			<Code code={streamOutput ?? details.content} language="bash" />
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
				<Box>
					{streamData && <MessageParts data={streamData} status={status} />}
					{details.output && <Markdown source={details.output.response} />}
				</Box>
			</>
		);
	}

	return (
		<Box flexDirection="column" gap={1}>
			{detailsNode ?? (
				<>
					<Code
						code={JSON.stringify(details.input, null, 2)}
						language="json"
						filename="input"
					/>
					<Code
						code={JSON.stringify(details.output, null, 2)}
						language="json"
						filename="output"
					/>
				</>
			)}
		</Box>
	);
}

export default function ToolCall({
	message,
	part,
	display,
	isFocused,
}: {
	message?: MessageState;
	part: Extract<RenderedPart, { type: "toolCall" }>;
	display: ToolCallDisplayType;
	isFocused?: boolean;
}) {
	const hasFeedback =
		display.approval === "pending" || display.feedback === "pending";

	return (
		<Task>
			<Task.Status
				status={display.result}
				emoji="⚙️ "
				parts={display.status.map((part) =>
					typeof part === "string"
						? { text: part }
						: { text: part.subject, style: chalk.bold },
				)}
			/>
			<Task.Details>
				<ToolCallDetails part={part} details={display} />
			</Task.Details>
			{message && hasFeedback && (
				<Task.Details collapse={false}>
					<ToolFeedback
						message={message}
						part={part}
						display={display}
						isFocused={isFocused}
					/>
				</Task.Details>
			)}
		</Task>
	);
}
