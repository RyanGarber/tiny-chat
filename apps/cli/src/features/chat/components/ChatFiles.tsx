import { useChatFileTree } from "@tiny-chat/client/features/chat/hooks/useChatFileTree.ts";
import { useFileDiff } from "@tiny-chat/client/features/chat/hooks/useFileDiff.ts";
import { useFileViewer } from "@tiny-chat/client/features/chat/hooks/useFileViewer.ts";
import { useChatStore } from "@tiny-chat/client/features/chat/stores/useChatStore.ts";
import type {
	ChatFile,
	ChatFileChanges,
	ChatFileNode,
	GitRepo,
} from "@tiny-chat/client/features/chat/types/chatFiles.ts";
import { ChatFilesUtils } from "@tiny-chat/client/features/chat/utils/ChatFilesUtils.ts";
import { CommonUtils } from "@tiny-chat/core/core/utils/CommonUtils.ts";
import { FileTypeUtils } from "@tiny-chat/core/features/file/utils/FileTypeUtils.ts";
import { PathUtils } from "@tiny-chat/core/features/file/utils/PathUtils.ts";
import type { zWebContext } from "@tiny-chat/core/features/provider/types/web.ts";
import { useInput, useWindowSize } from "ink";
import { type ReactNode, useMemo, useRef, useState } from "react";
import Anchor from "../../../core/components/Anchor.tsx";
import Box from "../../../core/components/Box.tsx";
import HelpText from "../../../core/components/HelpText.tsx";
import { usePanel } from "../../../core/components/Panel.tsx";
import ScrollView, {
	type ScrollViewProps,
} from "../../../core/components/ScrollView.tsx";
import Text from "../../../core/components/Text.tsx";
import { usePage } from "../../../core/hooks/usePage.ts";
import { WidthContext } from "../../../core/hooks/useWidth.ts";
import { useWorkingStatus } from "../../../core/hooks/useWorkingStatus.ts";
import { useAppStore } from "../../../core/stores/useAppStore.ts";
import { Code } from "../../code/components/Code.tsx";
import Diff from "../../code/components/Diff.tsx";
import Completions from "../../editor/components/Completions.tsx";
import Markdown from "../../message/components/Markdown.tsx";
import Image from "../../part/components/Image.tsx";

/** Lines of a file drawn in its preview; past this it is cut short. */
const MAX_LINES = 2000;

type Preview =
	| { type: "file"; file: ChatFile }
	| { type: "web"; source: zWebContext };

type Row =
	| { type: "node"; node: ChatFileNode; depth: number }
	| { type: "web"; source: zWebContext };

function Changes({ changes }: { changes: ChatFileChanges }) {
	return (
		<Box flexShrink={0} gap={1}>
			{changes.additions > 0 && (
				<Text color="greenBright">+{changes.additions}</Text>
			)}
			{changes.deletions > 0 && (
				<Text color="redBright">−{changes.deletions}</Text>
			)}
		</Box>
	);
}

function FilePreview({ file, repos }: { file: ChatFile; repos: GitRepo[] }) {
	const content = useFileViewer({ file });
	const diff = useFileDiff({ file, repos });
	const language = FileTypeUtils.getExtension(file);

	if (diff.data) {
		return (
			<Diff
				before={diff.data.before}
				after={diff.data.after}
				language={language}
			/>
		);
	}
	if (content.isError) {
		return (
			<Text color="redBright">
				{CommonUtils.formatError({ error: content.error })}
			</Text>
		);
	}
	if (!content.data || diff.isLoading) {
		return <Text color="textSubtle">loading…</Text>;
	}
	if (content.data.directory) {
		return (
			<Box flexDirection="column">
				{content.data.items?.map((item) => (
					<Text key={item.path} wrap="truncate-end">
						{PathUtils.name(item)}
						{item.directory && "/"}
					</Text>
				))}
			</Box>
		);
	}
	if (content.data.image) {
		return <Image src={content.data.image} alt={PathUtils.name(file)} />;
	}
	if (!content.data.text) {
		return <Text color="textSubtle">could not decode file</Text>;
	}
	if (content.data.extracted) {
		return <Markdown source={content.data.text} />;
	}
	const lines = content.data.text.split("\n");
	return (
		<Box flexDirection="column">
			<Code
				code={lines.slice(0, MAX_LINES).join("\n")}
				language={language}
				lineNumbers
			/>
			{lines.length > MAX_LINES && (
				<Text color="textSubtle">
					{` ⋮ ${lines.length - MAX_LINES} more lines`}
				</Text>
			)}
		</Box>
	);
}

function WebPreview({ source }: { source: zWebContext }) {
	return (
		<Box flexDirection="column" gap={1}>
			<Anchor href={source.url} color="textSubtle">
				{source.url}
			</Anchor>
			<Markdown source={source.content} />
		</Box>
	);
}

/**
 * A preview takes the arrows to scroll through itself, and `back` to close.
 */
function PreviewPane({
	preview,
	repos,
	fill,
	width,
}: {
	preview: Preview;
	repos: GitRepo[];
	fill: boolean;
	width?: number;
}) {
	const { rows } = useWindowSize();
	const ref = useRef<NonNullable<ScrollViewProps["ref"]>["current"]>(null);

	const { focused } = usePanel();
	useInput(
		(_input, key) => {
			const page = Math.max(1, (ref.current?.getViewportHeight() ?? 1) - 2);
			if (key.upArrow) ref.current?.scrollBy(-1);
			if (key.downArrow) ref.current?.scrollBy(1);
			if (key.pageUp) ref.current?.scrollBy(-page);
			if (key.pageDown) ref.current?.scrollBy(page);
		},
		{ isActive: focused },
	);

	const change =
		preview.type === "file"
			? ChatFilesUtils.changes({ path: preview.file.path, repos })
			: undefined;

	let title: ReactNode;
	let body: ReactNode;
	if (preview.type === "file") {
		title = PathUtils.name(preview.file);
		body = <FilePreview file={preview.file} repos={repos} />;
	} else {
		title =
			preview.source.title ||
			URL.parse(preview.source.url)?.hostname ||
			preview.source.url;
		body = <WebPreview source={preview.source} />;
	}

	return (
		<Box
			padding={1}
			flexDirection="column"
			backgroundColor="interior"
			flexGrow={fill ? 1 : 0}
			flexShrink={fill ? 1 : 0}
			minHeight={fill ? 0 : undefined}
		>
			<Box gap={1} paddingBottom={1}>
				<Box flexGrow={1} minWidth={0}>
					<Text bold wrap="truncate-end">
						{title}
					</Text>
				</Box>
				{change && <Changes changes={change} />}
			</Box>
			<WidthContext.Provider value={width ?? null}>
				<ScrollView
					ref={ref}
					resetKey={
						preview.type === "file" ? preview.file.path : preview.source.url
					}
					{...(fill
						? { flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: 0 }
						: { maxHeight: Math.floor(rows / 2) })}
					overscan={Number.POSITIVE_INFINITY}
				>
					{body}
				</ScrollView>
			</WidthContext.Provider>
			<HelpText actions={[{ key: "↑↓", name: "scroll" }, "back"]} />
		</Box>
	);
}

/**
 * The files and web pages the chat has touched. Files on the machine that sit
 * in a git repository show what changed in them since the last commit, and a
 * changed file previews as its diff.
 */
export default function ChatFiles(props: ChatFilesProps) {
	// What is open and selected starts over with each chat.
	const chatId = useChatStore((state) => state.chatId);
	return <ChatFilesList key={chatId} {...props} />;
}

interface ChatFilesProps {
	/** Drawn as a sidebar, taking the full height it is given. */
	fill?: boolean;
	/** Columns it has, when that is less than the terminal. */
	width?: number;
}

function ChatFilesList({ fill = false, width }: ChatFilesProps) {
	const { chatFiles, tree, webSources, repos, loadDirectory } =
		useChatFileTree();
	useWorkingStatus(chatFiles);

	const [preview, setPreview] = useState<Preview | null>(null);
	// Folders the reader opened or closed. The rest are open only when they are
	// just the way down to something, so the files themselves show at first.
	const [toggled, setToggled] = useState<Map<string, boolean>>(() => new Map());
	const [selected, setSelected] = useState(0);

	const { focused } = usePanel();
	const closePanel = useAppStore((state) => state.closePanel);
	usePage({
		active: focused,
		onBack: () => {
			if (preview) setPreview(null);
			else closePanel("files");
			return false;
		},
	});

	const isExpanded = (node: ChatFileNode) =>
		toggled.get(node.value) ?? !node.file;

	const rows = useMemo<Row[]>(
		() => [
			...ChatFilesUtils.flatten({
				nodes: tree,
				expanded: (node) => toggled.get(node.value) ?? !node.file,
			}).map((entry): Row => ({ type: "node", ...entry })),
			...webSources.map((source): Row => ({ type: "web", source })),
		],
		[tree, toggled, webSources],
	);
	const byValue = useMemo(
		() =>
			new Map(
				rows.map((row) => [
					row.type === "node" ? row.node.value : `web:${row.source.url}`,
					row,
				]),
			),
		[rows],
	);

	const toggle = (node: ChatFileNode, open = !isExpanded(node)) => {
		if (open && node.file?.local) loadDirectory(node.file);
		setToggled((current) => new Map(current).set(node.value, open));
	};

	if (preview) {
		return (
			<PreviewPane preview={preview} repos={repos} fill={fill} width={width} />
		);
	}

	return (
		<Completions
			fill={fill}
			selected={Math.min(selected, Math.max(0, rows.length - 1))}
			setSelected={(update) => setSelected(update)}
			selectFirstOnChange={false}
			groups={[
				{
					name: "files",
					items: rows.flatMap((row) =>
						row.type === "node"
							? [{ name: row.node.label, value: row.node.value }]
							: [],
					),
				},
				{
					name: "web sources",
					items: webSources.map((source) => ({
						name: source.title || source.url,
						value: `web:${source.url}`,
					})),
				},
			]}
			itemProps={{ flexGrow: 1, minWidth: 0 }}
			renderItem={({ item }) => {
				const row = byValue.get(item.value);
				if (row?.type === "web") {
					return (
						<Text wrap="truncate-end">
							{row.source.title ||
								URL.parse(row.source.url)?.hostname ||
								row.source.url}
						</Text>
					);
				}
				if (!row) return item.name ?? "";
				const { node, depth } = row;
				return (
					<Box flexGrow={1} minWidth={0} gap={1}>
						<Box flexGrow={1} minWidth={0}>
							<Text wrap="truncate-end">
								{"  ".repeat(depth)}
								<Text color="textSubtle">
									{node.directory ? (isExpanded(node) ? "▾ " : "▸ ") : "  "}
								</Text>
								{node.label}
								{node.directory && "/"}
							</Text>
						</Box>
						{node.changes && <Changes changes={node.changes} />}
					</Box>
				);
			}}
			onInput={({ item, key }) => {
				const row = item && byValue.get(item.value);
				if (!row) return;
				if (row.type === "web") {
					if (key.return) setPreview({ type: "web", source: row.source });
					return;
				}
				const { node } = row;
				if (node.directory) {
					if (key.return) toggle(node);
					if (key.rightArrow) toggle(node, true);
					if (key.leftArrow) toggle(node, false);
					return;
				}
				if (key.return && node.file)
					setPreview({ type: "file", file: node.file });
			}}
			renderEmpty={() => "nothing here yet"}
			actions={[
				"select",
				{ key: "←→", name: "fold" },
				"back",
				{ key: "tab", name: "focus" },
			]}
		/>
	);
}
