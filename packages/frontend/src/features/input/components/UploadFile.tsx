import { useMessagingStore } from '@/features/chat/stores/useMessagingStore';
import { query } from '@/utils/api';
import { Icon } from '@iconify/react';
import { ActionIcon, Group, ScrollArea, Stack, Text } from '@mantine/core';
import { format } from 'timeago.js';
import Attachments from './Attachments';
import { useSentinel } from '@/core/hooks/useSentinel';
import { glassStyle } from '@/utils/glass';
import Dropzone from '@/features/input/components/Dropzone';
import { useUploads } from '../hooks/useUploads';
import Sentinel from '@/core/components/Sentinel';

export function UploadFile({ onClose }: { onClose: () => void }) {
  const addUploads = useMessagingStore((s) => s.addUploads);

  const { fileUploads, deleteUpload } = useUploads();

  const { viewportRef, sentinelRef } = useSentinel({
    query: fileUploads,
    queryKey: query.input.listUploads.pathKey(),
  });

  return (
    <Stack h="100%">
      <Dropzone type="upload" />
      <ScrollArea h={300} viewportRef={viewportRef}>
        <Stack gap="xs">
          {fileUploads.data?.pages.flatMap((page) => page.uploads).length === 0 && (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              No recent uploads
            </Text>
          )}
          {fileUploads.data?.pages
            .flatMap((page) => page.uploads)
            .map((file) => (
              <Group
                key={file.id}
                justify="space-between"
                p="xs"
                bdrs="lg"
                style={{ ...glassStyle, cursor: 'pointer' }}
                onClick={() => {
                  addUploads({
                    type: 'upload',
                    id: file.id,
                    name: file.name,
                    thumbnail: file.thumbnail ?? undefined,
                  });
                  onClose();
                }}
              >
                <Group gap="sm" style={{ minWidth: 0, flex: 1 }}>
                  <Attachments list={[{ name: file.name, image: file.thumbnail ?? undefined }]} />
                  <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
                    <Text
                      size="sm"
                      fw={500}
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {file.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {file.createdAt ? format(file.createdAt) : ''}
                    </Text>
                  </Stack>
                </Group>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteUpload.mutate(file.id);
                  }}
                  loading={deleteUpload.isPending && deleteUpload.variables === file.id}
                  disabled={deleteUpload.isPending && deleteUpload.variables === file.id}
                >
                  <Icon icon="lucide:trash" height={16} />
                </ActionIcon>
              </Group>
            ))}
          <Sentinel isFetching={fileUploads.isFetching} ref={sentinelRef} />
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
