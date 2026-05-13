import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useState, useEffect, useMemo } from 'react';
import { trpc } from '@/utils/api';
import { useMessaging } from '@/stores/messaging.tsx';
import { Icon } from '@iconify/react';

interface Project {
  id: number;
  fullName: string;
  name: string;
  description: string | null;
  private: boolean;
  url: string;
  updatedAt: string;
  defaultBranch: string;
}

export default function GitHub({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [repos, setRepos] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cloningIds, setCloningIds] = useState<Set<number>>(new Set());
  const [clonedIds, setClonedIds] = useState<Set<number>>(new Set());
  const [cloneErrors, setCloneErrors] = useState<Map<number, string>>(new Map());
  const addUploads = useMessaging((s) => s.addUploads);

  useEffect(() => {
    if (!opened) return;
    setLoading(true);
    setError(null);
    trpc.github.list
      .query()
      .then((data) => {
        setRepos(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to load repositories';
        setError(msg);
        setLoading(false);
      });
  }, [opened]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return repos;
    return repos.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q),
    );
  }, [repos, search]);

  const handleClone = async (repo: Project) => {
    setCloningIds((prev) => new Set(prev).add(repo.id));
    setCloneErrors((prev) => {
      const next = new Map(prev);
      next.delete(repo.id);
      return next;
    });

    try {
      const [owner, repoName] = repo.fullName.split('/');
      addUploads(
        await trpc.github.clone.mutate({
          owner,
          repo: repoName,
          branch: repo.defaultBranch,
        }),
      );
      setClonedIds((prev) => new Set(prev).add(repo.id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Clone failed';
      setCloneErrors((prev) => new Map(prev).set(repo.id, msg));
    } finally {
      setCloningIds((prev) => {
        const next = new Set(prev);
        next.delete(repo.id);
        return next;
      });
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap={6}>
          <Icon icon="lucide:github" height={18} />
          <Text fw={600}>Clone a Repository</Text>
        </Group>
      }
      size="lg"
    >
      <Stack gap="sm">
        <TextInput
          placeholder="Search repositories…"
          leftSection={<Icon icon="lucide:search" height={16} />}
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.currentTarget.value)}
          autoFocus
        />

        {loading && (
          <Center py={40}>
            <Loader size="sm" />
          </Center>
        )}

        {error && (
          <Center py={20}>
            <Stack align="center" gap={4}>
              <Icon icon="lucide:alert-circle" height={24} color="var(--mantine-color-red-5)" />
              <Text size="sm" c="red">
                {error}
              </Text>
            </Stack>
          </Center>
        )}

        {!loading && !error && (
          <ScrollArea h={420} scrollbarSize={6}>
            <Stack gap={4}>
              {filtered.length === 0 && (
                <Center py={40}>
                  <Text size="sm" c="dimmed">
                    No repositories found
                  </Text>
                </Center>
              )}
              {filtered.map((repo) => {
                const isCloning = cloningIds.has(repo.id);
                const isCloned = clonedIds.has(repo.id);
                const cloneError = cloneErrors.get(repo.id);

                return (
                  <Box
                    key={repo.id}
                    p="xs"
                    style={{
                      borderRadius: 'var(--mantine-radius-sm)',
                      border: '1px solid var(--mantine-color-default-border)',
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
                            {cloneError}
                          </Text>
                        )}
                        <Text size="xs" c="dimmed">
                          Updated {formatDate(repo.updatedAt)}
                        </Text>
                      </Stack>
                      <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
                        <Tooltip label="Open on GitHub" color="gray" position="left">
                          <ActionIcon
                            variant="subtle"
                            size="sm"
                            component="a"
                            href={repo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Icon icon="lucide:external-link" height={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Button
                          size="xs"
                          variant={isCloned ? 'filled' : 'light'}
                          color={isCloned ? 'green' : undefined}
                          leftSection={
                            isCloning ? (
                              <Loader size={12} />
                            ) : isCloned ? (
                              <Icon icon="lucide:check" height={12} />
                            ) : (
                              <Icon icon="lucide:git-branch" height={12} />
                            )
                          }
                          loading={isCloning}
                          disabled={isCloning || isCloned}
                          onClick={() => void handleClone(repo)}
                        >
                          {isCloned ? 'Cloned' : 'Clone'}
                        </Button>
                      </Group>
                    </Group>
                  </Box>
                );
              })}
            </Stack>
          </ScrollArea>
        )}
      </Stack>
    </Modal>
  );
}
