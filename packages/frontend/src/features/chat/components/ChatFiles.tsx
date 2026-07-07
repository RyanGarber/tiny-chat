import {
  ActionIcon,
  Badge,
  Box,
  Burger,
  Group,
  Image,
  Loader,
  RenderTreeNodePayload,
  ScrollArea,
  Stack,
  Text,
  Tree,
  type TreeNodeData,
} from '@mantine/core';
import type { listAllFilesInChat } from '@tiny-chat/backend/src/routes/input.ts';
import { mimeType, pathName } from '@tiny-chat/shared/src/utils/files.ts';
import { useChatFiles } from '@/features/chat/hooks/useChatFiles.ts';
import { useLayoutStore } from '@/core/stores/useLayoutStore.tsx';
import { ReactNode, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { useChatStore } from '@/features/chat/stores/useChatStore.ts';
import { useThemes } from '@/features/settings/hooks/useThemes.ts';
import { theme } from '@/utils/icon.ts';
import { FilePreview, FilePreviewItem } from '@/features/uploads/components/FilePreview.tsx';

type AllFilesData = Awaited<ReturnType<typeof listAllFilesInChat>>;
type FileEntry = AllFilesData[string][number];

interface FileNodeProps {
  type: 'file';
  entry: FileEntry;
}
interface DirNodeProps {
  type: 'dir';
  segment: string;
  hasChanges: boolean;
}

/** Build the diff badge for a file entry. Returns null for upload-only files (no chat version). */
function LineDiffBadge({ entry }: { entry: FileEntry }) {
  const { file, uploadFile } = entry;

  if (!file) return null;

  const diff = file.lines - (uploadFile?.lines ?? 0);
  if (diff === 0) return null;

  const positive = diff > 0;
  return (
    <Badge
      size="xs"
      variant="light"
      color={positive ? 'green' : 'red'}
      style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}
    >
      {positive ? '+' : ''}
      {diff}
    </Badge>
  );
}

function entryHasChanges(entry: FileEntry): boolean {
  if (!entry.file) return false;
  return entry.file.lines !== (entry.uploadFile?.lines ?? 0);
}

/** Build pure-data tree nodes from file entries, nesting by path segments */
function buildNodes(entries: FileEntry[], uploadName: string): TreeNodeData[] {
  interface DirNode {
    children: Map<string, DirNode>;
    entry?: FileEntry;
  }
  const root: DirNode = { children: new Map() };

  for (const entry of entries) {
    const path = entry.file?.path ?? entry.uploadFile?.path ?? [];
    let node = root;
    for (let i = 0; i < path.length; i++) {
      const segment = path[i];
      if (!node.children.has(segment)) {
        node.children.set(segment, { children: new Map() });
      }
      node = node.children.get(segment)!;
      if (i === path.length - 1) {
        node.entry = entry;
      }
    }
  }

  function nodeHasChanges(dirNode: DirNode): boolean {
    if (dirNode.entry) return entryHasChanges(dirNode.entry);
    for (const child of dirNode.children.values()) {
      if (nodeHasChanges(child)) return true;
    }
    return false;
  }

  function toTreeNodes(dirNode: DirNode, prefix: string): TreeNodeData[] {
    const nodes: TreeNodeData[] = [];
    for (const [segment, child] of dirNode.children) {
      const value = `${prefix}/${segment}`;
      if (child.entry) {
        nodes.push({
          label: segment,
          value,
          nodeProps: { type: 'file', entry: child.entry } satisfies FileNodeProps,
        });
      } else {
        nodes.push({
          label: segment,
          value,
          nodeProps: {
            type: 'dir',
            segment,
            hasChanges: nodeHasChanges(child),
          } satisfies DirNodeProps,
          children: toTreeNodes(child, value),
        });
      }
    }
    return nodes;
  }

  return toTreeNodes(root, uploadName);
}

/** Reusable file tree that renders both file and directory nodes */
function FileTree({
  entries,
  uploadName,
}: {
  entries: FileEntry[];
  uploadName: string;
  dark: boolean;
}) {
  const data = useMemo(() => buildNodes(entries, uploadName), [entries, uploadName]);
  return <Tree data={data} renderNode={FileTreeNode} />;
}

function FileTreeNode({
  node,
  expanded,
  elementProps,
}: {
  node: TreeNodeData;
  expanded: boolean;
  elementProps: RenderTreeNodePayload['elementProps'];
}) {
  const props = node.nodeProps as FileNodeProps | DirNodeProps;

  const chatId = useChatStore((s) => s.chatId)!;
  const { loadChatFileData } = useChatFiles();
  const [isHovering, setIsHovering] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<FilePreviewItem | null>(null);

  const segment =
    props.type === 'file'
      ? pathName(props.entry.file?.path ?? props.entry.uploadFile?.path ?? [])
      : props.segment;
  const uploadId = props.type === 'file' ? (props.entry.uploadFile?.uploadId ?? null) : null;
  const path =
    props.type === 'file' ? (props.entry.file?.path ?? props.entry.uploadFile?.path ?? []) : [];

  const iconId =
    props.type === 'file'
      ? theme.getFileIconId(segment, undefined, false)
      : theme.getFolderIconId(segment, expanded, false);
  const icon = iconId ? theme.getIconContent(iconId, 'base64') : null;

  let options: ReactNode;

  if (props.type === 'file') {
    const isLoadingData =
      loadChatFileData.isPending &&
      loadChatFileData.variables.uploadId === uploadId &&
      loadChatFileData.variables.path === path;

    options =
      isHovering || isLoadingData ? (
        <>
          <ActionIcon
            variant="transparent"
            bdrs={0}
            size="xs"
            disabled={isLoadingData}
            loading={isLoadingData && loadChatFileData.variables.reason === 'copy'}
            onClick={(e) => {
              e.stopPropagation();
              loadChatFileData
                .mutateAsync({ chatId, uploadId, path, reason: 'copy' })
                .then((data) => {
                  if (data) {
                    navigator.clipboard
                      .write([
                        new ClipboardItem({
                          [data.mime.startsWith('image/') ? data.mime : 'text/plain']: new Blob(
                            [data.data],
                            { type: data.mime },
                          ),
                        }),
                      ])
                      .catch((error) => console.log(error));
                  }
                })
                .catch((error) => console.log(error));
            }}
          >
            <Icon icon="lucide:copy" width={14} />
          </ActionIcon>
          <ActionIcon
            variant="transparent"
            bdrs={0}
            size="xs"
            disabled={isLoadingData}
            loading={isLoadingData && loadChatFileData.variables.reason === 'download'}
            onClick={(e) => {
              e.stopPropagation();
              loadChatFileData
                .mutateAsync({ chatId, uploadId, path, reason: 'download' })
                .then((data) => {
                  if (data) {
                    const blob = new Blob([data.data], { type: data.mime });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = pathName(path);
                    a.click();
                    URL.revokeObjectURL(url);
                  }
                })
                .catch((error) => console.log(error));
            }}
          >
            <Icon icon="lucide:download" width={14} />
          </ActionIcon>
        </>
      ) : (
        <LineDiffBadge entry={props.entry} />
      );
  }

  return (
    <Group gap={5} {...elementProps} py={5}>
      <Icon
        icon={expanded ? 'lucide:chevron-down' : 'lucide:chevron-right'}
        width={16}
        style={{ opacity: props.type === 'file' ? 0 : 1, flexShrink: 0 }}
      />
      {props.type === 'file' && (
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
        style={{ cursor: props.type === 'file' ? 'pointer' : undefined }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onClick={() => {
          if (props.type !== 'file') return;
          loadChatFileData
            .mutateAsync({
              chatId,
              uploadId,
              path,
              reason: 'preview',
            })
            .then((data) => {
              if (!data) return;
              let binary = '';
              const length = data.data.length;
              for (let i = 0; i < length; i++) {
                binary += String.fromCharCode(data.data[i]);
              }
              mimeType(data.data, pathName(data.path), data.mime)
                .then((mime) => {
                  setPreviewData({ name: segment, mime, data: btoa(binary) });
                  setIsPreviewOpen(true);
                })
                .catch(console.error);
            })
            .catch(console.error);
        }}
      >
        {icon && (
          <Image src={`data:${icon.mimeType};base64,${icon.data}`} alt={segment} w={16} h={16} />
        )}
        <Text flex={1} miw={0} size="sm" truncate>
          {segment}
        </Text>
        {props.type === 'dir' && props.hasChanges && (
          <Box
            w={6}
            h={6}
            style={{
              borderRadius: '50%',
              flexShrink: 0,
              backgroundColor: 'var(--mantine-color-orange-5)',
            }}
          />
        )}
        {options}
      </Group>
    </Group>
  );
}

export default function ChatFiles() {
  const { chatFiles } = useChatFiles();
  const { theme } = useThemes();

  const isAsideOpen = useLayoutStore((s) => s.isAsideOpen);
  const setAsideOpen = useLayoutStore((s) => s.setAsideOpen);

  const dark = theme.data === 'dark';
  const data = chatFiles.data ?? {};
  const uploadKeys = Object.keys(data).filter((k) => k !== '');
  const files = data[''] ?? [];

  return (
    <Stack flex={1} h="100%" p={5}>
      <Group>
        <Burger opened={isAsideOpen} onClick={() => setAsideOpen(!isAsideOpen)} size="sm" />
      </Group>

      <ScrollArea h="100%" offsetScrollbars={true}>
        <Group justify="center">{chatFiles.isFetching && <Loader size="xs" />}</Group>

        {files.length > 0 && (
          <Stack gap={4} mb="xs">
            <Text size="xs" fw={600} c="dimmed" tt="uppercase">
              Chat files
            </Text>
            <FileTree entries={files} uploadName="chat" dark={dark} />
          </Stack>
        )}

        {uploadKeys.map((uploadId) => {
          const entries = data[uploadId] ?? [];
          const uploadName =
            entries[0]?.file?.uploadName ?? entries[0]?.uploadFile?.uploadName ?? uploadId;

          return (
            <Stack key={uploadId} gap={4} mb="xs">
              <Text size="xs" fw={600} c="dimmed" tt="uppercase" truncate title={uploadName}>
                {uploadName}
              </Text>
              <FileTree entries={entries} uploadName={uploadId} dark={dark} />
            </Stack>
          );
        })}

        {Object.keys(data).length === 0 && !chatFiles.isFetching && (
          <Text size="sm" c="dimmed">
            No files
          </Text>
        )}
      </ScrollArea>
    </Stack>
  );
}
