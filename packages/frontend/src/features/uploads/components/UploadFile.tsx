import { useMessagingStore } from '@/features/chat/stores/useMessagingStore';
import { query } from '@/utils/api';
import { Icon } from '@iconify/react';
import { ActionIcon, Group, ScrollArea, Stack, Text } from '@mantine/core';
import { format } from 'timeago.js';
import FileThumbnails from './FileThumbnails.tsx';
import { useSentinel } from '@/core/hooks/useSentinel';
import { GLASS_STYLE } from '@/utils/theme';
import Dropzone from '@/features/uploads/components/Dropzone';
import { useUploads } from '../hooks/useUploads';
import Sentinel from '@/core/components/Sentinel';

export function UploadFile({ onClose }: { onClose: () => void }) {
  const addUploads = useMessagingStore((s) => s.addUploads);

  const { attachmentUploads, deleteUpload } = useUploads();

  const { viewportRef, sentinelRef } = useSentinel({
    query: attachmentUploads,
    queryKey: query.input.listUploads.pathKey(),
  });

  return (
    <Stack h="100%">
      <Dropzone type="ATTACHMENT" />
      <ScrollArea h={300} viewportRef={viewportRef}>
        <Stack gap="xs">
          {attachmentUploads.data?.pages.flatMap((page) => page.uploads).length === 0 && (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              No recent uploads
            </Text>
          )}
          {attachmentUploads.data?.pages
            .flatMap((page) => page.uploads)
            .map((upload) => (
              <Group
                key={upload.id}
                justify="space-between"
                p="xs"
                bdrs="lg"
                style={{ ...GLASS_STYLE, cursor: 'pointer' }}
                onClick={() => {
                  addUploads({
                    type: 'upload',
                    id: upload.id,
                    name: upload.name,
                    thumbnail: upload.thumbnail ?? undefined,
                  });
                  onClose();
                }}
              >
                <Group gap="sm" style={{ minWidth: 0, flex: 1 }}>
                  <FileThumbnails
                    uploads={[
                      {
                        id: upload.id,
                        name: upload.name,
                        thumbnail: upload.thumbnail ?? undefined,
                      },
                    ]}
                  />
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
                      {upload.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {upload.createdAt ? format(upload.createdAt) : ''}
                    </Text>
                  </Stack>
                </Group>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteUpload.mutate({ id: upload.id });
                  }}
                  loading={deleteUpload.isPending && deleteUpload.variables.id === upload.id}
                  disabled={deleteUpload.isPending && deleteUpload.variables.id === upload.id}
                >
                  <Icon icon="lucide:trash" height={16} />
                </ActionIcon>
              </Group>
            ))}
          <Sentinel isFetching={attachmentUploads.isFetching} ref={sentinelRef} />
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
