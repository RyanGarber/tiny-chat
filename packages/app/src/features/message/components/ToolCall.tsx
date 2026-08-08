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
import { ChatService } from "@tiny-chat/client/src/features/chat/services/ChatService.ts";
import type { MarkdownContext } from "@tiny-chat/client/src/features/message/components/MarkdownContext.tsx";
import { FileTypeUtils } from "@tiny-chat/core/src/features/file/utils/FileTypeUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import type { ToolCallUtils } from "@tiny-chat/core/src/features/tool/utils/ToolCallUtils.ts";
import { memo, type ReactNode, useState } from "react";
import type { BundledLanguage } from "streamdown";
import { format } from "timeago.js";
import { Code, Diff } from "#app/core/components/Components.tsx";
import { theme } from "#app/core/utils/IconUtils.ts";
import { TauriUtils } from "#app/features/tauri/utils/TauriUtils.ts";

/**
 * Renders the expanded details content for a tool call.
 * Extracted as a separate component so it only mounts when expanded,
 * avoiding heavy JSX computation (Code, Diff, etc.) for collapsed tool calls.
 */
const ToolCallDetails = memo(
	({ details }: { details: ReturnType<typeof ToolCallUtils.getDisplay> }) => {
		let detailsNode: ReactNode;

		if (details.name === "search_web" && details.output) {
			detailsNode = (
				<Stack>
					{details.output.map((result) => (
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
					))}
				</Stack>
			);
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
						language="markdown"
						code={details.output.content}
						lineNumbers={false}
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
			detailsNode = (
				<Stack>
					{details.output.map((action) => (
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
								Go to chat
							</Anchor>
							{action.next_run_at && (
								<Text truncate="end">{format(action.next_run_at)}</Text>
							)}
						</Box>
					))}
				</Stack>
			);
		} else if (details.name === "search_chats" && details.output) {
			detailsNode = (
				<Stack>
					{details.output.map((message) => (
						<Box key={message.snippet}>
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
								Go to chat
							</Anchor>
							<Text truncate="end">{message.snippet}</Text>
						</Box>
					))}
				</Stack>
			);
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
			detailsNode = (
				<Stack>
					{details.output.map((result) => (
						<Stack key={result.fact} gap={0}>
							<Text>{result.fact}</Text>
							<Text size="xs" c="dimmed">
								(learned {format(result.created_at)})
							</Text>
						</Stack>
					))}
				</Stack>
			);
		} else if (details.name === "read_file" && details.content) {
			detailsNode = (
				<Stack>
					<Text fw={500}>{details.input.path}</Text>
					{details.content.type === "image" && (
						<Image src={details.content.value} />
					)}
					{details.content.type === "text" && (
						<Code
							filename={details.name}
							language={
								FileTypeUtils.getExtension({
									name: details.name,
									path: details.input.path,
								}) as BundledLanguage
							}
							code={details.content.value}
						/>
					)}
				</Stack>
			);
		} else if (details.name === "write_file" && details.output) {
			detailsNode = (
				<Stack>
					<Text fw={500}>{details.output.path}</Text>
					<Code
						filename={details.name}
						language={details.language}
						code={details.input.content}
					/>
				</Stack>
			);
		} else if (details.name === "edit_file" && details.output) {
			detailsNode = (
				<Stack>
					<Text fw={500}>{details.output.path}</Text>
					<Diff
						filename={details.name}
						language={details.language}
						before={details.input.old_string}
						after={details.input.new_string}
					/>
				</Stack>
			);
		} else if (details.name === "read_dir" && details.output) {
			detailsNode = (
				<Stack>
					<Group gap="xs">
						<Text fw={500}>{details.input.path}</Text>
						<Text c="dimmed">
							{details.output.length} item
							{details.output.length === 1 ? "" : "s"}
						</Text>
					</Group>
					{details.output.map((item) => {
						const iconId = !item.is_dir
							? theme?.getFileIconId(item.path, undefined, false)
							: theme?.getFolderIconId(item.path, false, false);
						const icon = iconId
							? theme?.getIconContent(iconId, "base64")
							: null;

						return (
							<Group key={item.path} gap={5} miw={0}>
								{icon && (
									<Image
										w="auto"
										h={20}
										src={`data:${icon.mimeType};base64,${icon.data}`}
									/>
								)}
								<Text truncate="end">
									{PathUtils.name(item)}
									{item.is_dir ? "/" : ""}
								</Text>
							</Group>
						);
					})}
				</Stack>
			);
		} else if (
			(details.name === "search_files" || details.name === "grep_files") &&
			details.output
		) {
			detailsNode = (
				<Stack>
					{details.output.map((file) => (
						<Box key={file.path}>
							<Text fw={500}>{file.path}</Text>
							<Text truncate="end">{file.snippet}</Text>
						</Box>
					))}
				</Stack>
			);
		} else if (details.name === "find_files" && details.output) {
			detailsNode = (
				<Stack>
					{details.output.map((path) => {
						const iconId = theme?.getFileIconId(path, undefined, false);
						const icon = iconId
							? theme?.getIconContent(iconId, "base64")
							: null;
						return (
							<Group key={path} gap={5} miw={0}>
								{icon && (
									<Image
										w="auto"
										h={20}
										src={`data:${icon.mimeType};base64,${icon.data}`}
									/>
								)}
								<Text truncate="end">{PathUtils.name(path)}</Text>
							</Group>
						);
					})}
				</Stack>
			);
		} else if (details.name === "shell_exec" && details.content) {
			detailsNode = <Code language="bash" code={details.content ?? ""} />;
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
				{detailsNode ?? (
					<Stack>
						<Text>Input</Text>
						<JsonTree data={details.input} withExpandAll withCopyToClipboard />
						<Text>Output</Text>
						<JsonTree data={details.output} withExpandAll withCopyToClipboard />
					</Stack>
				)}
			</Box>
		);
	},
);

export const ToolCall = memo(
	({
		display,
		textSize,
	}: {
		display: ReturnType<typeof ToolCallUtils.getDisplay>;
		textSize?: NonNullable<MarkdownContext<string>["style"]>["textSize"];
	}) => {
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
					<Icon
						icon="lucide:wrench"
						height={18}
						style={{ minWidth: 18 }}
						color="var(--mantine-color-dimmed)"
					/>
					<Text
						truncate="end"
						c={display.result === "error" ? "red" : undefined}
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
				<Collapse
					expanded={expanded}
					className={textSize ? `**:${textSize}` : undefined}
				>
					{expanded && <ToolCallDetails details={display} />}
				</Collapse>
			</Box>
		);
	},
	(previous, next) =>
		previous.display.name === next.display.name &&
		previous.display.status === next.display.status &&
		previous.display.feedback === next.display.feedback &&
		previous.display.approval === next.display.approval &&
		previous.display.result === next.display.result &&
		previous.display.input === next.display.input &&
		previous.display.output === next.display.output &&
		previous.display.append === next.display.append &&
		previous.textSize === next.textSize,
);
