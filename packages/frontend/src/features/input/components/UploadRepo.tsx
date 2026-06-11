import { useMessagingStore } from '@/features/chat/stores/useMessagingStore';
import { query } from '@/utils/api';
import { Icon } from '@iconify/react';
import {
  ActionIcon,
  Badge,
  Box,
  Center,
  Group,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useState } from 'react';
import { format } from 'timeago.js';
import { useMutation, useQuery } from '@tanstack/react-query';
import { glassStyle } from '@/utils/glass';
import { useUploads } from '../hooks/useUploads';
import Sentinel from '@/core/components/Sentinel';

export function UploadRepo({ onClose }: { onClose: () => void }) {
  // Logic from GitHub.tsx
  const [search, setSearch] = useState('');
  const addUploads = useMessagingStore((s) => s.addUploads);

  const repos = useQuery({
    ...query.input.listRepos.queryOptions(),
    select: (data) =>
      [...data.filter((p) => p.fullName.toLowerCase().includes(search.toLowerCase().trim()))].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
  });

  const cloneRepo = useMutation({
    ...query.input.cloneRepo.mutationOptions(),
    onSuccess: (data) => {
      addUploads(data);
      void repoUploads.refetch();
    },
  });

  const { repoUploads, deleteUpload } = useUploads();

  return (
    <Stack h="100%" gap="md">
      <TextInput
        placeholder="Search repositories…"
        leftSection={<Icon icon="lucide:search" height={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
      />

      {repos.isError ? (
        <Text size="sm" c="red" ta="center">
          {repos.error?.message}
        </Text>
      ) : (
        <ScrollArea h={400} scrollbarSize={6}>
          <Stack gap="xs">
            {repos.data?.length === 0 && (
              <Center py={20}>
                <Text size="sm" c="dimmed">
                  No repositories found
                </Text>
              </Center>
            )}
            {repos.data?.map((repo) => {
              const [owner, repoName] = repo.fullName.split('/');
              const historyItem = repoUploads.data?.find(
                (u) => u.repoName === repo.fullName && u.branch === repo.defaultBranch,
              );

              const isMutating =
                cloneRepo.variables?.owner === owner &&
                cloneRepo.variables?.repo === repoName &&
                cloneRepo.variables?.branch === repo.defaultBranch;
              const isCloning = isMutating ? cloneRepo.isPending : false;
              const cloneError = isMutating ? cloneRepo.error : undefined;

              return (
                <Box
                  key={repo.id}
                  p="xs"
                  bdrs="lg"
                  style={{ ...glassStyle, cursor: historyItem ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (!historyItem) return;
                    addUploads({ type: 'upload', id: historyItem.id, name: historyItem.name });
                    onClose();
                  }}
                >
                  <Group justify="space-between" wrap="nowrap" gap="xs">
                    <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                      <Group gap={6} wrap="nowrap">
                        <Text size="sm" fw={500} truncate>
                          {repo.fullName}
                        </Text>
                        {repo.private && (
                          <Badge size="xs" variant="light" color="gray">
                            private
                          </Badge>
                        )}
                      </Group>
                      {repo.description && (
                        <Text size="xs" c="dimmed" truncate>
                          {repo.description}
                        </Text>
                      )}
                      {cloneError && (
                        <Text size="xs" c="red" truncate>
                          {cloneError instanceof Error ? cloneError.message : 'Unknown error'}
                        </Text>
                      )}
                      <Group gap={6} wrap="nowrap">
                        <Text size="xs" c="dimmed" flex="0 0 auto">
                          Last commit {format(repo.updatedAt)}
                        </Text>
                      </Group>
                    </Stack>
                    <Stack gap={4} align="end">
                      <Group gap={0} wrap="nowrap">
                        {historyItem && (
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteUpload.mutate(historyItem.id);
                            }}
                            loading={
                              deleteUpload.isPending && deleteUpload.variables === historyItem.id
                            }
                            disabled={
                              deleteUpload.isPending && deleteUpload.variables === historyItem.id
                            }
                          >
                            <Icon icon="lucide:trash" height={16} />
                          </ActionIcon>
                        )}
                        <ActionIcon
                          variant="subtle"
                          color="dimmed"
                          onClick={(e) => {
                            e.stopPropagation();
                            cloneRepo.mutate({
                              owner,
                              repo: repoName,
                              branch: repo.defaultBranch,
                            });
                          }}
                          loading={isCloning}
                          disabled={isCloning}
                        >
                          {historyItem ? (
                            <Icon icon="lucide:refresh-cw" height={16} />
                          ) : (
                            <Icon icon="lucide:download-cloud" height={16} />
                          )}
                        </ActionIcon>
                      </Group>
                      {historyItem && (
                        <Text size="xs" c="dimmed" truncate>
                          {format(historyItem.createdAt)}
                        </Text>
                      )}
                    </Stack>
                  </Group>
                </Box>
              );
            })}
            <Sentinel isFetching={repos.isFetching} />
          </Stack>
        </ScrollArea>
      )}
    </Stack>
  );
}
