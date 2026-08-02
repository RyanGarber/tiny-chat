import { Icon } from "@iconify/react";
import {
	ActionIcon,
	Badge,
	Box,
	Burger,
	Group,
	Image,
	Loader,
	type RenderTreeNodePayload,
	ScrollArea,
	Stack,
	Text,
	Tree,
	type TreeNodeData,
} from "@mantine/core";
import { useChatStore } from "@tiny-chat/client/src/features/chat/stores/useChatStore.ts";
import type { FileNode } from "@tiny-chat/core/src/features/file/types/file.ts";
import { FileTypeUtils } from "@tiny-chat/core/src/features/file/utils/FileTypeUtils.ts";
import {
	type Descendent,
	FileUtils,
} from "@tiny-chat/core/src/features/file/utils/FileUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { type ReactNode, useMemo, useState } from "react";
import { useLayoutStore } from "#ui/core/stores/useLayoutStore.tsx";
import { theme } from "#ui/core/utils/IconUtils.ts";
import {
	FilePreview,
	type FilePreviewItem,
} from "#ui/features/upload/components/FilePreview.tsx";
import { useFilesystem } from "#ui/features/upload/hooks/useFilesystem.ts";

interface FileTreeNodeProps {
	type: "file";
	node: FileNode;
}
interface DirTreeNodeProps {
	type: "directory";
	segment: string;
	hasChanges: boolean;
}

/** Build the diff badge for a file entry. Returns null for upload-only files (no chat version). */
function LineDiffBadge({ node }: { node: FileNode }) {
	const { chatFile, uploadFile } = node;

	if (!chatFile) return null;

	const diff = chatFile.lines - (uploadFile?.lines ?? 0);
	if (diff === 0) return null;

	const positive = diff > 0;
	return (
		<Badge
			size="xs"
			variant="light"
			color={positive ? "green" : "red"}
			style={{ fontVariantNumeric: "tabular-nums", flexShrink: 0 }}
		>
			{positive ? "+" : ""}
			{diff}
		</Badge>
	);
}

function nodeHasChanges(node: FileNode): boolean {
	if (!node.chatFile) return false;
	return node.chatFile.lines !== (node.uploadFile?.lines ?? 0);
}

/** Build pure-data tree nodes from file entries, nesting by path segments */
function buildTreeNodes(nodes: FileNode[]): TreeNodeData[] {
	const root = FileUtils.toTree({ nodes });

	function directoryHasChanges(directory: Descendent<FileNode>): boolean {
		if (directory.node) return nodeHasChanges(directory.node);
		for (const child of directory.children.values()) {
			if (directoryHasChanges(child)) return true;
		}
		return false;
	}

	function toTreeNodes(
		descendent: Descendent<FileNode>,
		prefix = "",
	): TreeNodeData[] {
		const treeNodes: TreeNodeData[] = [];
		for (const [segment, child] of descendent.children) {
			const value = prefix.length ? `${prefix}/${segment}` : segment;
			if (child.node && !child.node.isDirectory) {
				treeNodes.push({
					label: segment,
					value,
					nodeProps: {
						type: "file",
						node: child.node,
					} satisfies FileTreeNodeProps,
				});
			} else {
				treeNodes.push({
					label: segment,
					value,
					nodeProps: {
						type: "directory",
						segment,
						hasChanges: directoryHasChanges(child),
					} satisfies DirTreeNodeProps,
					children: toTreeNodes(child, value),
				});
			}
		}
		return treeNodes;
	}

	return toTreeNodes(root);
}

/** Reusable file tree that renders both file and directory nodes */
function FileTree({ nodes }: { nodes: FileNode[] }) {
	const data = useMemo(() => buildTreeNodes(nodes), [nodes]);
	return <Tree data={data} renderNode={FileTreeNode} />;
}

function FileTreeNode({
	node,
	expanded,
	elementProps,
}: {
	node: TreeNodeData;
	expanded: boolean;
	elementProps: RenderTreeNodePayload["elementProps"];
}) {
	const props = node.nodeProps as FileTreeNodeProps | DirTreeNodeProps;

	const chatId = useChatStore((s) => s.chatId);

	const { readChatFile } = useFilesystem();
	const [isHovering, setIsHovering] = useState(false);
	const [isPreviewOpen, setIsPreviewOpen] = useState(false);
	const [previewData, setPreviewData] = useState<FilePreviewItem | null>(null);

	const segment =
		props.type === "file" ? PathUtils.name(props.node) : props.segment;
	const path = props.type === "file" ? props.node.path : [];

	const iconId =
		props.type === "file"
			? theme?.getFileIconId(segment, undefined, false)
			: theme?.getFolderIconId(segment, expanded, false);
	const icon = iconId ? theme?.getIconContent(iconId, "base64") : null;

	let options: ReactNode;

	if (!chatId) return;

	if (props.type === "file") {
		const isLoadingFile =
			readChatFile.isPending && readChatFile.variables.path === path;

		options =
			isHovering || isLoadingFile ? (
				<>
					<ActionIcon
						variant="transparent"
						bdrs={0}
						size="xs"
						disabled={isLoadingFile}
						loading={isLoadingFile && readChatFile.variables.meta === "copy"}
						onClick={(e) => {
							e.stopPropagation();
							readChatFile
								.mutateAsync({ chat: chatId, path, meta: "copy" })
								.then((data) => {
									if (data) {
										navigator.clipboard
											.write([
												new ClipboardItem({
													[data.mime.startsWith("image/")
														? data.mime
														: "text/plain"]: new Blob([data.data], {
														type: data.mime,
													}),
												}),
											])
											.catch((error) => console.error(error));
									}
								})
								.catch((error) => console.error(error));
						}}
					>
						<Icon icon="lucide:copy" width={14} />
					</ActionIcon>
					<ActionIcon
						variant="transparent"
						bdrs={0}
						size="xs"
						disabled={isLoadingFile}
						loading={
							isLoadingFile && readChatFile.variables.meta === "download"
						}
						onClick={(e) => {
							e.stopPropagation();
							readChatFile
								.mutateAsync({ chat: chatId, path, meta: "download" })
								.then((data) => {
									if (data) {
										const blob = new Blob([data.data], { type: data.mime });
										const url = URL.createObjectURL(blob);
										const a = document.createElement("a");
										a.href = url;
										a.download = PathUtils.name({ path });
										a.click();
										URL.revokeObjectURL(url);
									}
								})
								.catch((error) => console.error(error));
						}}
					>
						<Icon icon="lucide:download" width={14} />
					</ActionIcon>
				</>
			) : (
				<LineDiffBadge node={props.node} />
			);
	}

	return (
		<Group gap={5} {...elementProps} py={5}>
			<Icon
				icon={expanded ? "lucide:chevron-down" : "lucide:chevron-right"}
				width={16}
				style={{ opacity: props.type === "file" ? 0 : 1, flexShrink: 0 }}
			/>
			{props.type === "file" && (
				<FilePreview
					opened={isPreviewOpen}
					onClose={() => setIsPreviewOpen(false)}
					items={previewData ? [previewData] : []}
				/>
			)}
			<Group
				flex={1}
				miw={0}
				gap={5}
				wrap="nowrap"
				style={{ cursor: props.type === "file" ? "pointer" : undefined }}
				onMouseEnter={() => setIsHovering(true)}
				onMouseLeave={() => setIsHovering(false)}
				onClick={() => {
					if (props.type !== "file") return;
					readChatFile
						.mutateAsync({
							chat: chatId,
							path,
							meta: "preview",
						})
						.then(({ data, path, mime }) => {
							FileTypeUtils.getMime({ data, path, fallback: mime })
								.then((mime) => {
									setPreviewData({
										name: segment,
										mime,
										data: FileUtils.getBase64FromBytes({ data }),
									});
									setIsPreviewOpen(true);
								})
								.catch(console.error);
						})
						.catch(console.error);
				}}
			>
				{icon && (
					<Image
						src={`data:${icon.mimeType};base64,${icon.data}`}
						alt={segment}
						w="auto"
						h={20}
					/>
				)}
				<Text flex={1} miw={0} size="sm" truncate>
					{segment}
				</Text>
				{props.type === "directory" && props.hasChanges && (
					<Box
						w={6}
						h={6}
						style={{
							borderRadius: "50%",
							flexShrink: 0,
							backgroundColor: "var(--mantine-color-orange-5)",
						}}
					/>
				)}
				{options}
			</Group>
		</Group>
	);
}

export default function ChatFiles() {
	const { chatFiles } = useFilesystem();

	const isAsideOpen = useLayoutStore((s) => s.isAsideOpen);
	const setAsideOpen = useLayoutStore((s) => s.setAsideOpen);

	return (
		<Stack flex={1} h="100%" p={5}>
			<Group>
				<Burger
					opened={isAsideOpen}
					onClick={() => setAsideOpen(!isAsideOpen)}
					size="sm"
				/>
			</Group>

			<ScrollArea h="100%" offsetScrollbars={true}>
				<Group justify="center">
					{chatFiles.isFetching && <Loader size="xs" />}
				</Group>

				{chatFiles.data && chatFiles.data.length > 0 && (
					<Stack gap={4} mb="xs">
						<Text size="xs" fw={600} c="dimmed" tt="uppercase">
							Files
						</Text>
						<FileTree nodes={chatFiles.data} />
					</Stack>
				)}

				{chatFiles.data && chatFiles.data.length === 0 && (
					<Text size="sm" c="dimmed">
						No files
					</Text>
				)}
			</ScrollArea>
		</Stack>
	);
}
