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
import { useEffect, useMemo, useRef, useState } from "react";
import type { BundledLanguage } from "streamdown";
import { useAppStore } from "#app/core/stores/useAppStore.ts";
import { useChatFilesStore } from "#app/features/chat/stores/useChatFilesStore.ts";
import Code from "#app/features/code/components/Code.tsx";
import Diff from "#app/features/code/components/Diff.tsx";
import Markdown from "#app/features/message/components/Markdown.tsx";
import Image from "#app/features/part/components/Image.tsx";
import Web from "#app/features/part/components/Web.tsx";
import SourceTag from "#app/features/upload/components/SourceTag.tsx";

interface FileTreeNodeProps {
	node: ChatFileNode;
}

function toTreeData(nodes: ChatFileNode[]): TreeNodeData[] {
	return nodes.map((node) => ({
		value: node.value,
		label: node.label,
		nodeProps: { node } satisfies FileTreeNodeProps,
		children: toTreeData(node.children),
	}));
}

function Changes({ changes }: { changes: ChatFileChanges }) {
	return (
		<Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
			{changes.additions > 0 && (
				<Text size="xs" c="green" ff="monospace">
					+{changes.additions}
				</Text>
			)}
			{changes.deletions > 0 && (
				<Text size="xs" c="red" ff="monospace">
					−{changes.deletions}
				</Text>
			)}
		</Group>
	);
}

function FilePreview({ file, repos }: { file: ChatFile; repos: GitRepo[] }) {
	const content = useFileViewer({ file });
	const diff = useFileDiff({ file, repos });
	const language = (FileTypeUtils.getExtension(file) ?? undefined) as
		| BundledLanguage
		| undefined;
	if (diff.data) {
		return (
			<Diff
				filename={file.path}
				language={language}
				before={diff.data.before}
				after={diff.data.after}
				maw="100%"
				fillHeight
			/>
		);
	}
	if (content.isError) {
		return (
			<Text c="red">{CommonUtils.formatError({ error: content.error })}</Text>
		);
	}
	if (!content.data || diff.isLoading) {
		return <Skeleton width="100%" height="auto" style={{ aspectRatio: 2 }} />;
	}
	if (content.data.directory) {
		return (
			<Stack gap={5}>
				{content.data.items?.map((item) => (
					<SourceTag
						key={item.path}
						path={item.path}
						directory={item.directory}
					>
						<Text size="sm" truncate>
							{PathUtils.name(item)}
							{item.directory && "/"}
						</Text>
					</SourceTag>
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
	onLoadDirectory: (file: ChatFile) => void;
	onPreview: (file: ChatFile) => void;
	highlighted: boolean;
}) {
	const { node: fileNode } = node.nodeProps as FileTreeNodeProps;
	const file = fileNode.file;
	const directory = fileNode.directory;
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
			<SourceTag
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
			</SourceTag>
			{fileNode.changes && <Changes changes={fileNode.changes} />}
		</Group>
	);
}

export default function ChatFiles() {
	const {
		chatFiles,
		files,
		tree: fileTree,
		webSources: chatWebSources,
		repos,
		loadDirectory,
	} = useChatFileTree();
	const chatId = useChatStore((state) => state.chatId);
	const isAsideOpen = useAppStore((state) => state.isAsideOpen);
	const setAsideOpen = useAppStore((state) => state.setAsideOpen);
	const viewFile = useChatFilesStore((state) => state.viewFile);
	const viewedFile = useChatFilesStore((state) => {
		if (!state.viewedFile) return null;
		if (state.viewedFile.chatId !== chatId) return null;
		return state.viewedFile;
	});
	const tree = useTree();
	const treeRef = useRef(tree);
	const treeViewport = useRef<HTMLDivElement>(null);
	const processedViewedFile = useRef<typeof viewedFile>(null);
	const highlightFrame = useRef<number>(undefined);
	const highlightTimeout = useRef<number>(undefined);
	const [highlightedNode, setHighlightedNode] = useState<string | null>(null);
	useEffect(() => {
		treeRef.current = tree;
	}, [tree]);

	// A page opened from a citation stays listed even if no message has it.
	const webSources = useMemo(
		() =>
			viewedFile?.web &&
			!chatWebSources.some((source) => source.url === viewedFile.web?.url)
				? [...chatWebSources, viewedFile.web]
				: chatWebSources,
		[chatWebSources, viewedFile],
	);
	const previewedWeb = viewedFile?.path.startsWith("web:")
		? (viewedFile.web ??
			webSources.find((source) => source.url === viewedFile.path.slice(4)))
		: undefined;
	const webSelectionRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (viewedFile && previewedWeb && isAsideOpen) {
			webSelectionRef.current?.scrollIntoView({
				behavior: "smooth",
				block: "nearest",
			});
		}
	}, [previewedWeb, viewedFile, isAsideOpen]);
	const treeData = useMemo(() => toTreeData(fileTree), [fileTree]);
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
	const viewedNode = useMemo(
		() => (previewedFile ? ChatFilesUtils.node(previewedFile) : null),
		[previewedFile],
	);

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

	return (
		<Stack flex={1} h="100%" p={5} gap="xs">
			<Burger
				opened={isAsideOpen}
				onClick={() => setAsideOpen(!isAsideOpen)}
				size="sm"
			/>
			<ScrollArea
				flex={previewedFile || previewedWeb ? 0 : 1}
				mah={previewedFile || previewedWeb ? "45%" : undefined}
				offsetScrollbars
				viewportRef={treeViewport}
			>
				<Group justify="center">
					{chatFiles.isFetching && <Loader size="xs" />}
				</Group>
				<Text size="sm" fw={600} mb="xs">
					Files
				</Text>
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
				<Text size="sm" fw={600} mt="md" mb="xs">
					Web sources
				</Text>
				<Stack gap="xs">
					{webSources.map((source) => (
						<div
							key={source.url}
							ref={
								previewedWeb?.url === source.url ? webSelectionRef : undefined
							}
						>
							<SourceTag
								path={`web:${source.url}`}
								web={source}
								wrap="nowrap"
								py={4}
							>
								<Text size="sm" flex={1} miw={0} truncate>
									{source.title ??
										URL.parse(source.url)?.hostname ??
										source.url}
								</Text>
							</SourceTag>
						</div>
					))}
					{!webSources.length && (
						<Text size="sm" c="dimmed">
							No web sources
						</Text>
					)}
				</Stack>
			</ScrollArea>
			{previewedWeb && (
				<Box flex={1} mih={0}>
					<Group gap={4} mb="xs" wrap="nowrap">
						<ActionIcon
							variant="subtle"
							aria-label="Close web preview"
							onClick={() => viewFile(null)}
						>
							<CaretLeftIcon size={18} />
						</ActionIcon>
					</Group>
					<Box h="calc(100% - 24px)">
						<Web key={previewedWeb.url} source={previewedWeb} h="100%" />
					</Box>
				</Box>
			)}
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
						<FilePreview file={previewedFile} repos={repos} />
					</Box>
				</Box>
			)}
		</Stack>
	);
}
