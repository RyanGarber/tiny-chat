import { Icon } from "@iconify/react";
import {
	ActionIcon,
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
import { useChatFiles } from "@tiny-chat/client/src/features/chat/hooks/useChatFiles.ts";
import type { FileNode } from "@tiny-chat/core/src/features/file/types/file.ts";
import { FileTypeUtils } from "@tiny-chat/core/src/features/file/utils/FileTypeUtils.ts";
import {
	type Descendent,
	FileUtils,
} from "@tiny-chat/core/src/features/file/utils/FileUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { type ReactNode, useMemo, useState } from "react";
import { useAppStore } from "#app/core/stores/useAppStore.ts";
import { theme } from "#app/core/utils/IconUtils.ts";
import {
	FilePreview,
	type FilePreviewItem,
} from "#app/features/upload/components/FilePreview.tsx";

interface FileTreeNodeProps {
	type: "file";
	node: FileNode;
}
interface DirTreeNodeProps {
	type: "directory";
	segment: string;
}

/** What each of the mount's trees is called in the sidebar. */
const TREES: Record<string, string> = {
	uploads: "Uploads",
	skills: "Skills",
	chat: "Chat",
};

/**
 * Where a file sits in the sidebar, which is not quite where it sits on the
 * mount: a tree reads as its name, an upload as what it was uploaded as, and
 * the chat's own id is dropped — there is only ever the one chat here, so a
 * folder named after it would say nothing.
 */
function toDisplayPath(node: FileNode): string[] {
	const [tree, id, ...rest] = node.path;
	if (!tree) return [];

	const label = TREES[tree] ?? tree;
	if (!id) return [label];
	if (tree === "chat") return [label, ...rest];

	return [label, node.name || id, ...rest];
}

interface DisplayNode {
	path: string[];
	node: FileNode;
}

/** Build pure-data tree nodes, nesting by path segment and dropping empty branches. */
function buildTreeNodes(nodes: FileNode[]): TreeNodeData[] {
	const root = FileUtils.toTree<DisplayNode>({
		nodes: nodes.flatMap((node) => {
			const path = toDisplayPath(node);
			return path.length ? [{ path, node }] : [];
		}),
	});

	function hasFiles(descendent: Descendent<DisplayNode>): boolean {
		if (descendent.node && !descendent.node.node.isDirectory) return true;
		for (const child of descendent.children.values()) {
			if (hasFiles(child)) return true;
		}
		return false;
	}

	function toTreeNodes(
		descendent: Descendent<DisplayNode>,
		prefix = "",
	): TreeNodeData[] {
		const treeNodes: TreeNodeData[] = [];
		for (const [segment, child] of descendent.children) {
			const value = prefix.length ? `${prefix}/${segment}` : segment;
			if (child.node && !child.node.node.isDirectory) {
				treeNodes.push({
					label: segment,
					value,
					nodeProps: {
						type: "file",
						node: child.node.node,
					} satisfies FileTreeNodeProps,
				});
			} else if (hasFiles(child)) {
				treeNodes.push({
					label: segment,
					value,
					nodeProps: {
						type: "directory",
						segment,
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

	const { readChatFile } = useChatFiles();
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
								.mutateAsync({ path, meta: "copy" })
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
								.mutateAsync({ path, meta: "download" })
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
			) : null;
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
						.mutateAsync({ path, meta: "preview" })
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
					{node.label as string}
				</Text>
				{options}
			</Group>
		</Group>
	);
}

export default function ChatFiles() {
	const { chatFiles } = useChatFiles();

	const isAsideOpen = useAppStore((s) => s.isAsideOpen);
	const setAsideOpen = useAppStore((s) => s.setAsideOpen);

	const nodes = chatFiles.data ?? [];
	const hasFiles = nodes.some((node) => !node.isDirectory);

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

				{hasFiles && (
					<Stack gap={4} mb="xs">
						<Text size="xs" fw={600} c="dimmed" tt="uppercase">
							Files
						</Text>
						<FileTree nodes={nodes} />
					</Stack>
				)}

				{chatFiles.data && !hasFiles && (
					<Text size="sm" c="dimmed">
						No files
					</Text>
				)}
			</ScrollArea>
		</Stack>
	);
}
