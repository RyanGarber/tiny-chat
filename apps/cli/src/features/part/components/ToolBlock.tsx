import type { AgentStreamEvent } from "@tiny-chat/client/core/services/StreamService.ts";
import { PathUtils } from "@tiny-chat/core/features/file/utils/PathUtils.ts";
import type { ToolBlock as ToolBlockType } from "@tiny-chat/core/features/tool/types/display.ts";
import Image from "ink-picture";
import type { ReactNode } from "react";
import Anchor from "../../../core/components/Anchor.tsx";
import Box from "../../../core/components/Box.tsx";
import Content from "../../../core/components/Content.tsx";
import Text from "../../../core/components/Text.tsx";
import { Code } from "../../code/components/Code.tsx";
import Diff from "../../code/components/Diff.tsx";
import Markdown from "../../message/components/Markdown.tsx";
import MessageParts from "../../message/components/MessageParts.tsx";
import Quote from "./Quote.tsx";

/** Lines a block is held to while it grows, keeping its newest in view. */
const TAIL_LINES = 12;

/**
 * Keeps only the last lines of growing content, the way a terminal scrolls,
 * with a note of how many came before. Released once the content settles.
 */
function Tail({
	follow,
	value,
	children,
}: {
	follow: boolean;
	value: string;
	children: (value: string) => ReactNode;
}) {
	if (!follow) return children(value);
	const lines = value.split("\n");
	const hidden = Math.max(0, lines.length - TAIL_LINES);
	return (
		<Box flexDirection="column">
			{hidden > 0 && <Text dimColor>{` ⋮ ${hidden} earlier lines`}</Text>}
			{children(hidden ? lines.slice(hidden).join("\n") : value)}
		</Box>
	);
}

/** A path shown relative to the directory it was listed from. */
const relative = (root: string, path: string) => {
	const base = PathUtils.normalize({ path: root, unix: true }).replace(
		/\/$/,
		"",
	);
	const normalized = PathUtils.normalize({ path, unix: true });
	return normalized.startsWith(`${base}/`)
		? normalized.slice(base.length + 1)
		: normalized;
};

/**
 * Draws one piece of tool content. This is the whole of the CLI's knowledge
 * of tools: each tool describes itself in these blocks, so a new tool needs no
 * code here.
 */
export default function ToolBlock({
	block,
	active,
}: {
	block: ToolBlockType;
	/** Whether the call is still streaming or running. */
	active: boolean;
}) {
	switch (block.type) {
		case "text":
			return (
				<Text
					color={
						block.tone === "error"
							? "red"
							: block.tone === "dimmed"
								? "textSubtle"
								: undefined
					}
				>
					{block.value}
				</Text>
			);
		case "markdown": {
			const markdown = <Markdown source={block.value} streaming={active} />;
			return block.quote ? <Quote>{markdown}</Quote> : markdown;
		}
		case "code":
			return (
				<Tail follow={active || !!block.terminal} value={block.value}>
					{(value) => (
						<Code
							code={value}
							language={block.language}
							filename={block.title}
						/>
					)}
				</Tail>
			);
		case "file":
			if (block.image) return <Image src={block.image} />;
			return (
				<Tail follow={active} value={block.content ?? ""}>
					{(value) => (
						<Code
							code={value}
							language={block.language}
							filename={block.path}
						/>
					)}
				</Tail>
			);
		case "diff":
			return (
				<Diff
					before={block.before}
					after={block.after}
					language={block.language}
					filename={block.path}
				/>
			);
		case "directory":
			return (
				<Code
					language="text"
					filename={block.path}
					code={block.entries
						.map(
							(entry) =>
								`${relative(block.path, entry.path)}${entry.directory ? "/" : ""}`,
						)
						.join("\n")}
				/>
			);
		case "web":
			return (
				<Content formatter={() => block.source.content} streaming={active}>
					<Box flexDirection="column" gap={1} paddingX={2} paddingY={1}>
						<Box flexDirection="column" paddingRight={8}>
							<Text bold>
								{block.source.title ??
									URL.parse(block.source.url)?.hostname ??
									block.source.url}
							</Text>
							<Anchor href={block.source.url} wrap="truncate-end" />
						</Box>
						<Tail follow={active} value={block.source.content}>
							{(value) => <Markdown source={value} streaming={active} />}
						</Tail>
					</Box>
				</Content>
			);
		case "record":
			return (
				<Box flexDirection="column">
					<Text bold wrap="truncate-end">
						{block.title.replaceAll("\n", " ")}
					</Text>
					{block.description && (
						<Text wrap="truncate-end">
							{block.description.replaceAll("\n", " ")}
						</Text>
					)}
					{block.details?.map((detail) => (
						<Text key={detail} color="textSubtle">
							{detail}
						</Text>
					))}
				</Box>
			);
		case "json":
			return (
				<Code
					code={JSON.stringify(block.value, null, 2) ?? "undefined"}
					language="json"
					filename={block.title}
				/>
			);
		case "messages": {
			const latest = block.data.at(-1)?.at(-1)?.type;
			const status: AgentStreamEvent["status"] | undefined = !active
				? undefined
				: latest === "thought"
					? "thinking"
					: "generating";
			return (
				<Box flexDirection="column">
					<MessageParts data={block.data} status={status} />
				</Box>
			);
		}
	}
}
