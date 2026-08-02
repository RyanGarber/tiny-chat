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
import { useTools } from "@tiny-chat/client/src/features/agent/hooks/useTools.ts";
import { ChatService } from "@tiny-chat/client/src/features/chat/services/ChatService.ts";
import { useActions } from "@tiny-chat/client/src/features/user/hooks/useActions.ts";
import type { zDataPart } from "@tiny-chat/core/src/features/data/types/message.ts";
import { FileTypeUtils } from "@tiny-chat/core/src/features/file/utils/FileTypeUtils.ts";
import { ToolCallUtils } from "@tiny-chat/core/src/features/tool/utils/ToolCallUtils.ts";
import { memo, type ReactNode, useState } from "react";
import type { BundledLanguage } from "streamdown";
import { format } from "timeago.js";
import { Code } from "#ui/core/components/Components.tsx";
import { theme } from "#ui/core/utils/IconUtils.ts";
import { TauriUtils } from "#ui/features/tauri/utils/TauriUtils.ts";

const FZ = "14px";

const StatusText = ({
	status,
	highlight,
}: {
	status: string;
	highlight?: string;
}) => {
	if (!highlight) return status;
	const index = status.indexOf(highlight);
	if (index === -1) return status;
	return (
		<>
			{status.slice(0, index)}
			<span style={{ fontWeight: 500 }}>{highlight}</span>
			{status.slice(index + highlight.length)}
		</>
	);
};

export const ToolCall = memo(
	({
		toolCall,
		toolResult,
	}: {
		toolCall: Extract<zDataPart, { type: "toolCall" }>;
		toolResult?: Extract<zDataPart, { type: "toolResult" }>;
	}) => {
		const { toolsets } = useTools();
		const { actions } = useActions();

		const { status, highlight, pending, error, details } =
			ToolCallUtils.getDisplay({
				toolCall,
				toolResult,
				toolsets: toolsets,
				actions: actions.data,
			});

		const [expanded, setExpanded] = useState(false);

		let detailsNode: ReactNode;

		if (details?.kind === "search_web") {
			detailsNode = (
				<Stack>
					{details.results.map((result) => (
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
		} else if (details?.kind === "view_web") {
			detailsNode = (
				<Stack>
					{details.title && (
						<Text fw={500} fz={FZ}>
							{details.title}
						</Text>
					)}
					<Anchor
						fw={500}
						fz={FZ}
						target="_blank"
						href={details.url}
						onClick={(e) => {
							e.preventDefault();
							void TauriUtils.open(details.url);
						}}
					>
						{details.url}
					</Anchor>
					<Code
						language="markdown"
						code={details.content}
						lineNumbers={false}
					/>
				</Stack>
			);
		} else if (details?.kind === "action_mutation") {
			detailsNode = <Text fz={FZ}>{details.message}</Text>;
		} else if (details?.kind === "list_actions") {
			detailsNode = (
				<Stack>
					{details.actions.map((action) => (
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
									ChatService.setChat({ id: action.chat_id });
								}}
							>
								Go to chat
							</Anchor>
							{action.nextRunAt && (
								<Text truncate="end" fz={FZ}>
									{format(action.nextRunAt)}
								</Text>
							)}
						</Box>
					))}
				</Stack>
			);
		} else if (details?.kind === "search_chats") {
			detailsNode = (
				<Stack>
					{details.results.map((result) => (
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
		} else if (details?.kind === "memory_mutation") {
			detailsNode = <Text fz={FZ}>{details.message}</Text>;
		} else if (details?.kind === "search_memories") {
			detailsNode = (
				<Stack>
					{details.results.map((result) => (
						<Stack key={result.fact} gap={0}>
							<Text fz={FZ}>{result.fact}</Text>
							<Text size="xs" c="dimmed">
								(learned {format(result.created_at)})
							</Text>
						</Stack>
					))}
				</Stack>
			);
		} else if (details?.kind === "read_file" && details.data && details.mime) {
			let content: ReactNode;
			if (details.isImage) {
				const uri = `data:${details.mime};base64,${details.data}`;
				content = <Image src={uri} />;
			} else {
				content = (
					<Code
						filename={details.name}
						language={
							FileTypeUtils.getExtension({
								mime: details.mime,
								name: details.name,
								path: details.path,
							}) as BundledLanguage
						}
						code={details.text ?? "// failed to decode file"}
					/>
				);
			}
			detailsNode = (
				<Stack>
					<Text fw={500} fz={FZ}>
						{details.path}
					</Text>
					{content}
				</Stack>
			);
		} else if (details?.kind === "write_file") {
			detailsNode = (
				<Stack>
					<Text fw={500} fz={FZ}>
						{details.path}
					</Text>
					<Code
						filename={details.name}
						language={details.extension as BundledLanguage}
						code={details.content}
					/>
				</Stack>
			);
		} else if (details?.kind === "read_dir") {
			detailsNode = (
				<Stack>
					<Group gap="xs">
						<Text fw={500} fz={FZ}>
							{details.path}
						</Text>
						<Text c="dimmed" fz={FZ}>
							{details.items.length} item
							{details.items.length === 1 ? "" : "s"}
						</Text>
					</Group>
					{details.items.map((item) => {
						const iconId = !item.is_dir
							? theme?.getFileIconId(item.path, undefined, false)
							: theme?.getFolderIconId(item.path, false, false);
						const icon = iconId
							? theme?.getIconContent(iconId, "base64")
							: null;

						return (
							<Group key={item.name} gap={5} miw={0}>
								{icon && (
									<Image
										w="auto"
										h={20}
										src={`data:${icon.mimeType};base64,${icon.data}`}
									/>
								)}
								<Text truncate="end" fz={FZ}>
									{item.name}
									{item.is_dir ? "/" : ""}
								</Text>
							</Group>
						);
					})}
				</Stack>
			);
		} else if (details?.kind === "search_files") {
			detailsNode = (
				<Stack>
					{details.results.map((upload) => (
						<Box key={upload.name}>
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
		} else if (details?.kind === "shell_exec") {
			detailsNode = <Code language="bash" code={details.code} />;
		}

		return (
			<Box my={10}>
				<Group
					className={`shimmer-text ${pending ? "active" : ""}`}
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
					<Text truncate="end" fz={FZ} c={error ? "red" : undefined}>
						<StatusText status={status} highlight={highlight} />
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
							{detailsNode ?? (
								<Stack>
									<Text fz={FZ}>Input</Text>
									<JsonTree
										data={
											details?.kind === "fallback"
												? details.args
												: (toolCall.args as unknown)
										}
										withExpandAll
										withCopyToClipboard
									/>
									<Text fz={FZ}>Output</Text>
									<JsonTree
										data={
											details?.kind === "fallback"
												? details.value
												: toolResult?.value
										}
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
