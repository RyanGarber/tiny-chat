import {
	ActionIcon,
	Box,
	Burger,
	Group,
	Loader,
	type RenderTreeNodePayload,
	ScrollArea,
	Skeleton,
	Stack,
	Text,
	Tree,
	type TreeNodeData,
	useTree,
} from "@mantine/core";
import {
	CaretDownIcon,
	CaretLeftIcon,
	CaretRightIcon,
} from "@phosphor-icons/react";
import { useTools } from "@tiny-chat/client/src/features/agent/hooks/useTools.ts";
import { useChatFiles } from "@tiny-chat/client/src/features/chat/hooks/useChatFiles.ts";
import { useChatStore } from "@tiny-chat/client/src/features/chat/stores/useChatStore.ts";
import { useDraftStore } from "@tiny-chat/client/src/features/chat/stores/useDraftStore.ts";
import { useMessages } from "@tiny-chat/client/src/features/message/hooks/useMessages.ts";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import type { MessageState } from "@tiny-chat/core/src/features/data/types/message.ts";
import { SourceUtils } from "@tiny-chat/core/src/features/data/utils/SourceUtils.ts";
import { FileTypeUtils } from "@tiny-chat/core/src/features/file/utils/FileTypeUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BundledLanguage } from "streamdown";
import { client } from "#app/client.ts";
import { useAppStore } from "#app/core/stores/useAppStore.ts";
import { useChatFilesStore } from "#app/features/chat/stores/useChatFilesStore.ts";
import Code from "#app/features/code/components/Code.tsx";
import Markdown from "#app/features/message/components/Markdown.tsx";
import Image from "#app/features/part/components/Image.tsx";
import FileTag from "#app/features/upload/components/FileTag.tsx";
import { useFileViewer } from "#app/features/upload/hooks/useFileViewer.ts";

interface SidebarFile {
	path: string;
	directory: boolean;
	local: boolean;
	displayPath: string[];
}
interface FileTreeNodeProps {
	type: "file" | "directory";
	file?: SidebarFile;
}

function toLocalFile(path: string, directory: boolean): SidebarFile {
	const normalized = PathUtils.normalize({ path, unix: true });
	return {
		path: normalized,
		directory,
		local: true,
		displayPath: ["local", ...PathUtils.split(normalized)],
	};
}

function attachmentFiles(message: Pick<MessageState, "data">): SidebarFile[] {
	return message.data
		.flat()
		.filter(
			(part) =>
				part.type === "attachment" &&
				!PathUtils.fromMount({ path: part.source }),
		)
		.map((part) =>
			toLocalFile(
				part.type === "attachment" ? part.source : "",
				part.type === "attachment" && part.content.type === "directory",
			),
		);
}

function buildTreeNodes(files: SidebarFile[]): TreeNodeData[] {
	type MutableNode = TreeNodeData & { children: MutableNode[] };
	const roots: MutableNode[] = [];
	const nodes = new Map<string, MutableNode>();
	for (const file of files) {
		let children = roots;
		for (let index = 0; index < file.displayPath.length; index++) {
			const parts = file.displayPath.slice(0, index + 1);
			const value = `${file.local ? "local" : "mount"}:${parts.join("/")}`;
			let node = nodes.get(value);
			if (!node) {
				node = { value, label: parts.at(-1) ?? "", children: [] };
				nodes.set(value, node);
				children.push(node);
			}
			children = node.children;
			if (index === file.displayPath.length - 1)
				node.nodeProps = {
					type: file.directory ? "directory" : "file",
					file,
				} satisfies FileTreeNodeProps;
		}
	}
	for (const [value, node] of nodes) {
		if (node.nodeProps || !value.startsWith("local:")) continue;
		node.nodeProps = {
			type: "directory",
		} satisfies FileTreeNodeProps;
	}
	return roots;
}

function FilePreview({ file }: { file: { path: string; directory: boolean } }) {
	const content = useFileViewer({ file });
	if (content.isError) {
		return (
			<Text c="red">{CommonUtils.formatError({ error: content.error })}</Text>
		);
	}
	if (!content.data) {
		return <Skeleton width="100%" height="auto" style={{ aspectRatio: 2 }} />;
	}
	if (content.data.directory) {
		return (
			<Stack gap={5}>
				{content.data.items?.map((item) => (
					<FileTag key={item.path} path={item.path} directory={item.directory}>
						<Text size="sm" truncate>
							{PathUtils.name(item)}
							{item.directory && "/"}
						</Text>
					</FileTag>
				)) ?? <Loader size="xs" my="md" />}
			</Stack>
		);
	}
	if (content.data.image) {
		return <Image src={content.data.image} filename={file.path} />;
	}
	if (!content.data.text) {
		return (
			<Code
				filename={file.path}
				code="// could not decode file"
				maw="100%"
				fillHeight
			/>
		);
	}
	return content.data.extracted ? (
		<Markdown source={content.data.text} />
	) : (
		<Code
			filename={file.path}
			language={FileTypeUtils.getExtension(file) as BundledLanguage}
			code={content.data.text}
			maw="100%"
			fillHeight
		/>
	);
}

function FileTreeNode({
	node,
	expanded,
	elementProps,
	onLoadDirectory,
	onPreview,
	highlighted,
}: RenderTreeNodePayload & {
	onLoadDirectory: (file: SidebarFile) => void;
	onPreview: (file: SidebarFile) => void;
	highlighted: boolean;
}) {
	const props = node.nodeProps as FileTreeNodeProps | undefined;
	const file = props?.file;
	const directory = props?.type !== "file";
	return (
		<Group
			gap={5}
			py={4}
			{...elementProps}
			onClick={(event) => {
				elementProps.onClick?.(event);
				if (directory && file?.local && !expanded) onLoadDirectory(file);
				if (!directory && file) onPreview(file);
			}}
			wrap="nowrap"
			style={{
				...elementProps.style,
				backgroundColor: highlighted
					? "var(--mantine-color-blue-light)"
					: "transparent",
				borderRadius: "var(--mantine-radius-sm)",
				transition: "background-color 900ms ease-out",
			}}
		>
			{expanded ? (
				<CaretDownIcon
					size={16}
					style={{ opacity: directory ? 1 : 0, flexShrink: 0 }}
				/>
			) : (
				<CaretRightIcon
					size={16}
					style={{ opacity: directory ? 1 : 0, flexShrink: 0 }}
				/>
			)}
			<FileTag
				path={file?.path ?? String(node.label)}
				directory={directory}
				expanded={expanded}
				viewable={false}
				flex={1}
			>
				<Text size="sm" flex={1} miw={0} truncate>
					{String(node.label)}
					{directory && "/"}
				</Text>
			</FileTag>
		</Group>
	);
}

export default function ChatFiles() {
	const { chatFiles } = useChatFiles();
	const { messages } = useMessages();
	const { toolsets } = useTools();
	const draftData = useDraftStore((state) => state.data);
	const chatId = useChatStore((state) => state.chatId);
	const isAsideOpen = useAppStore((state) => state.isAsideOpen);
	const setAsideOpen = useAppStore((state) => state.setAsideOpen);
	const viewFile = useChatFilesStore((state) => state.viewFile);
	const viewedFile = useChatFilesStore((state) => {
		if (!state.viewedFile) return null;
		if (state.viewedFile.chatId && chatId && state.viewedFile.chatId !== chatId)
			return null;
		return state.viewedFile;
	});
	const tree = useTree();
	const treeRef = useRef(tree);
	const treeViewport = useRef<HTMLDivElement>(null);
	const processedViewedFile = useRef<typeof viewedFile>(null);
	const highlightFrame = useRef<number>(undefined);
	const highlightTimeout = useRef<number>(undefined);
	const [highlightedNode, setHighlightedNode] = useState<string | null>(null);
	const [localEntries, setLocalEntries] = useState<{
		chatId: string | null;
		files: SidebarFile[];
	}>({ chatId, files: [] });
	const [loadingDirectories, setLoadingDirectories] = useState<Set<string>>(
		() => new Set(),
	);
	useEffect(() => {
		treeRef.current = tree;
	}, [tree]);

	const files = useMemo(() => {
		const mounted: SidebarFile[] = (chatFiles.data ?? []).map((node) => {
			const [tree, id, ...rest] = node.path;
			const displayPath =
				tree === "chat" ? [tree, ...rest] : [tree, id, ...rest].filter(Boolean);
			return {
				path: node.uri,
				directory: node.isDirectory,
				local: false,
				displayPath,
			};
		});
		const messageList =
			messages.data?.pages.flatMap((page) => page.messages) ?? [];
		const referenced = messageList.flatMap((message) => [
			...SourceUtils.find({ message, toolsets }).flatMap((source) =>
				source.type === "file" && !PathUtils.fromMount(source.value)
					? [toLocalFile(source.value.path, source.value.directory)]
					: [],
			),
			...attachmentFiles(message),
		]);
		const draft = attachmentFiles({ data: draftData });
		const localDirectories = [...referenced, ...draft].filter(
			(file) => file.local && file.directory,
		);
		const loaded =
			localEntries.chatId === chatId
				? localEntries.files.filter((entry) =>
						localDirectories.some(
							(directory) =>
								PathUtils.equals(directory.path, entry.path) ||
								PathUtils.contains({
									parent: directory.path,
									descendent: entry.path,
								}),
						),
					)
				: [];
		return [
			...new Map(
				[...mounted, ...referenced, ...draft, ...loaded].map((file) => [
					`${file.local}:${file.path}`,
					file,
				]),
			).values(),
		];
	}, [
		chatFiles.data,
		messages.data,
		toolsets,
		draftData,
		localEntries,
		chatId,
	]);
	const treeData = useMemo(() => buildTreeNodes(files), [files]);
	const previewedFile = useMemo(() => {
		if (!viewedFile) return null;
		return (
			files.find(
				(candidate) =>
					candidate.directory === viewedFile.directory &&
					PathUtils.equals(candidate.path, viewedFile.path),
			) ?? null
		);
	}, [files, viewedFile]);
	const viewedNode = useMemo(() => {
		if (!previewedFile) return null;
		const file = previewedFile;
		const prefix = file.local ? "local" : "mount";
		return {
			value: `${prefix}:${file.displayPath.join("/")}`,
			parents: file.displayPath
				.slice(0, -1)
				.map(
					(_, index) =>
						`${prefix}:${file.displayPath.slice(0, index + 1).join("/")}`,
				),
		};
	}, [previewedFile]);

	useEffect(() => {
		if (
			!viewedFile ||
			!viewedNode ||
			processedViewedFile.current === viewedFile
		)
			return;
		processedViewedFile.current = viewedFile;
		const currentTree = treeRef.current;
		currentTree.setExpandedState({
			...currentTree.expandedState,
			...Object.fromEntries(viewedNode.parents.map((parent) => [parent, true])),
		});

		cancelAnimationFrame(highlightFrame.current ?? 0);
		window.clearTimeout(highlightTimeout.current);
		highlightFrame.current = requestAnimationFrame(() => {
			setHighlightedNode(viewedNode.value);
			highlightFrame.current = requestAnimationFrame(() => {
				const node = treeViewport.current?.querySelector<HTMLElement>(
					`[role="treeitem"][data-value="${CSS.escape(viewedNode.value)}"]`,
				);
				node?.scrollIntoView({ behavior: "smooth", block: "nearest" });
				highlightTimeout.current = window.setTimeout(
					() => setHighlightedNode(null),
					100,
				);
			});
		});
	}, [viewedFile, viewedNode]);

	useEffect(() => {
		return () => {
			cancelAnimationFrame(highlightFrame.current ?? 0);
			window.clearTimeout(highlightTimeout.current);
		};
	}, []);

	const loadDirectory = (directory: SidebarFile) => {
		const directoryKey = `${chatId}:${directory.path}`;
		if (!client.shell || loadingDirectories.has(directoryKey)) return;
		setLoadingDirectories((current) => new Set(current).add(directoryKey));
		void client.shell
			.readDir({ path: directory.path })
			.then((entries) => {
				setLocalEntries((current) => ({
					chatId,
					files: [
						...(current.chatId === chatId ? current.files : []),
						...entries.map((entry) => toLocalFile(entry.path, entry.is_dir)),
					],
				}));
			})
			.catch((error) => {
				console.warn("Failed to read local directory", error);
				setLoadingDirectories((current) => {
					const next = new Set(current);
					next.delete(directoryKey);
					return next;
				});
			});
	};

	return (
		<Stack flex={1} h="100%" p={5} gap="xs">
			<Burger
				opened={isAsideOpen}
				onClick={() => setAsideOpen(!isAsideOpen)}
				size="sm"
			/>
			<ScrollArea
				flex={previewedFile ? 0 : 1}
				mah={previewedFile ? "45%" : undefined}
				offsetScrollbars
				viewportRef={treeViewport}
			>
				<Group justify="center">
					{chatFiles.isFetching && <Loader size="xs" />}
				</Group>
				{treeData.length ? (
					<Tree
						data={treeData}
						tree={tree}
						renderNode={(payload) => (
							<FileTreeNode
								{...payload}
								onLoadDirectory={loadDirectory}
								onPreview={(file) =>
									viewFile({
										path: file.path,
										directory: file.directory,
										chatId,
									})
								}
								highlighted={payload.node.value === highlightedNode}
							/>
						)}
					/>
				) : (
					<Text size="sm" c="dimmed">
						No files
					</Text>
				)}
			</ScrollArea>
			{previewedFile && (
				<Box flex={1} mih={0}>
					<Group gap={4} mb="xs">
						<ActionIcon variant="subtle" onClick={() => viewFile(null)}>
							<CaretLeftIcon size={18} />
						</ActionIcon>
						<Text
							size="xs"
							fw={600}
							flex={1}
							miw={0}
							truncate
							title={previewedFile.path}
						>
							{PathUtils.name(previewedFile.path)}
						</Text>
					</Group>
					<Box h="calc(100% - 24px)" style={{ overflow: "auto" }}>
						<FilePreview file={previewedFile} />
					</Box>
				</Box>
			)}
		</Stack>
	);
}
