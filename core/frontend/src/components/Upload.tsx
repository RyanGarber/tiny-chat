import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Loader,
  Menu,
  Modal,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  TextInput,
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { Icon } from '@iconify/react';
import { useState, useEffect, useMemo, useCallback, MouseEvent } from 'react';
import { trpc } from '@/utils/api';
import { useMessaging } from '@/stores/messaging.tsx';
import { uploadFiles } from '@/managers/uploading.ts';
import { format } from 'timeago.js';
import type { Upload as UploadType } from '@/stores/messaging.tsx';
import { useTasks } from '@/stores/tasks.tsx';
import Attachments from '@/components/Attachments.tsx';

const handleDelete = async (id: string, e: MouseEvent, refresh: () => void) => {
  e.stopPropagation();
  try {
    useTasks.getState().addTask('deleteUpload', 'Deleting upload');
    await trpc.uploads.delete.mutate({ id });
    refresh();
    void useTasks.getState().removeTask('deleteUpload');
  } catch (err) {
    console.error('Failed to delete upload', err);
  }
};

// --- Types ---

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

type UploadWithDate = UploadType & { createdAt: Date | string };

interface UploadModalProps {
  opened: boolean;
  onClose: () => void;
  tab: 'file' | 'repo';
  onTabChange: (tab: 'file' | 'repo') => void;
}

// --- Helper Components ---

function FileTab({ onClose }: { onClose: () => void }) {
  const [history, setHistory] = useState<UploadWithDate[]>([]);
  const [loading, setLoading] = useState(false);
  const { addUploads } = useMessaging();

  useEffect(() => {
    let mounted = true;
    (() => setLoading(true))();
    trpc.uploads.list
      .query()
      .then((data) => {
        if (!mounted) return;
        // Filter out GitHub uploads
        const uploads = data.filter((u) => !u.name.startsWith('GitHub: '));
        const sorted = uploads.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setHistory(sorted as unknown as UploadWithDate[]);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error('Failed to load upload history', err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Stack h="100%">
      <Dropzone
        onDrop={(files) => {
          void uploadFiles(files);
          onClose();
        }}
        h={120}
        styles={{ inner: { height: '100%' }, root: { cursor: 'pointer' } }}
      >
        <Group justify="center" gap="xl" style={{ pointerEvents: 'none' }} h="100%">
          <Dropzone.Accept>
            <Icon icon="lucide:upload" height={50} color="var(--mantine-color-blue-6)" />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <Icon icon="lucide:x" height={50} color="var(--mantine-color-red-6)" />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <Icon icon="lucide:file-up" height={50} color="var(--mantine-color-dimmed)" />
          </Dropzone.Idle>
          <Stack gap={0} align="center">
            <Text size="xl" inline>
              Drag files here or click to select
            </Text>
            <Text size="sm" c="dimmed" inline mt={7}>
              Attach files to your message
            </Text>
          </Stack>
        </Group>
      </Dropzone>

      <Text size="sm" fw={500} mt="sm">
        Recent
      </Text>

      {loading ? (
        <Center py="xl">
          <Loader size="sm" />
        </Center>
      ) : (
        <ScrollArea h={300}>
          <Stack gap="xs">
            {history.length === 0 && (
              <Text size="sm" c="dimmed" ta="center" py="xl">
                No recent uploads
              </Text>
            )}
            {history.map((file) => (
              <Group
                key={file.id}
                justify="space-between"
                p="xs"
                style={{
                  background: 'var(--tc-surface)',
                  borderRadius: 'var(--mantine-radius-md)',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  addUploads(file);
                  onClose();
                }}
              >
                <Group gap="sm">
                  <Attachments list={[{ name: file.name, image: file.thumbnail }]} />
                  <Stack gap={0}>
                    <Text size="sm" fw={500}>
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
                  onClick={(e) =>
                    void handleDelete(file.id, e, () =>
                      setHistory((prev) => prev.filter((u) => u.id !== file.id)),
                    )
                  }
                >
                  <Icon icon="lucide:trash" height={16} />
                </ActionIcon>
              </Group>
            ))}
          </Stack>
        </ScrollArea>
      )}
    </Stack>
  );
}

function RepoTab({ onClose }: { onClose: () => void }) {
  // Logic from GitHub.tsx
  const [repos, setRepos] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cloningIds, setCloningIds] = useState<Set<number>>(new Set());
  const [cloneErrors, setCloneErrors] = useState<Map<number, string>>(new Map());
  const { addUploads } = useMessaging();

  // History state
  const [history, setHistory] = useState<UploadWithDate[]>([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    trpc.github.list
      .query()
      .then((data) => {
        if (mounted) {
          setRepos(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (mounted) {
          const msg = err instanceof Error ? err.message : 'Failed to load repositories';
          setError(msg);
          setLoading(false);
        }
      });

    // Fetch previously cloned repos
    trpc.uploads.list
      .query()
      .then((data) => {
        if (mounted) {
          const repos = data.filter((u) => u.name.startsWith('GitHub: '));
          const sorted = repos.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
          setHistory(sorted as unknown as UploadWithDate[]);
        }
      })
      .catch((err) => {
        if (mounted) {
          console.error(err);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return repos;
    return repos.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q),
    );
  }, [repos, search]);

  const historyMap = useMemo(() => {
    const map = new Map<string, UploadWithDate>();
    for (const h of history) {
      // Matches "GitHub: owner/repo @ branch"
      const match = /^GitHub: ([^@]+) @ (.+)$/.exec(h.name);
      if (match) {
        const fullRepoName = match[1].trim();
        const branch = match[2].trim();
        map.set(`${fullRepoName}@${branch}`, h);
      }
    }
    return map;
  }, [history]);

  const handleClone = async (repo: Project) => {
    setCloningIds((prev) => new Set(prev).add(repo.id));
    setCloneErrors((prev) => {
      const next = new Map(prev);
      next.delete(repo.id);
      return next;
    });

    try {
      const [owner, repoName] = repo.fullName.split('/');
      const result = await trpc.github.clone.mutate({
        owner,
        repo: repoName,
        branch: repo.defaultBranch,
      });

      addUploads(result);

      // Update history
      setHistory((prev) => [result as unknown as UploadWithDate, ...prev]);

      onClose();
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
    return format(iso);
  };

  return (
    <Stack h="100%" gap="md">
      <TextInput
        placeholder="Search repositories…"
        leftSection={<Icon icon="lucide:search" height={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
      />

      {loading && (
        <Center py={20}>
          <Loader size="sm" />
        </Center>
      )}

      {error && (
        <Text size="sm" c="red" ta="center">
          {error}
        </Text>
      )}

      {!loading && !error && (
        <ScrollArea h={400} scrollbarSize={6}>
          <Stack gap={4}>
            {filtered.length === 0 && (
              <Center py={20}>
                <Text size="sm" c="dimmed">
                  No repositories found
                </Text>
              </Center>
            )}
            {filtered.map((repo) => {
              const isCloning = cloningIds.has(repo.id);
              const cloneError = cloneErrors.get(repo.id);
              const historyItem = historyMap.get(`${repo.fullName}@${repo.defaultBranch}`);

              return (
                <Box
                  key={repo.id}
                  p="xs"
                  style={{
                    background: 'var(--tc-surface)',
                    borderRadius: 'var(--mantine-radius-md)',
                    cursor: historyItem ? 'pointer' : 'default',
                  }}
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
                          {cloneError}
                        </Text>
                      )}
                      <Group gap={6} wrap="nowrap">
                        <Text size="xs" c="dimmed" flex="0 0 auto">
                          Updated {formatDate(repo.updatedAt)}
                        </Text>
                      </Group>
                    </Stack>
                    {historyItem && (
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={(e) =>
                          void handleDelete(historyItem.id, e, () =>
                            setHistory((prev) => prev.filter((u) => u.id !== historyItem.id)),
                          )
                        }
                      >
                        <Icon icon="lucide:trash" height={16} />
                      </ActionIcon>
                    )}
                    <Stack gap={4} align="center">
                      <Group gap={4} wrap="nowrap">
                        <Button
                          size="xs"
                          variant="light"
                          loading={isCloning}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleClone(repo);
                          }}
                        >
                          {historyItem ? 'Update' : 'Get'}
                        </Button>
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
          </Stack>
        </ScrollArea>
      )}
    </Stack>
  );
}

// --- Default Export: Upload Modal ---

export default function Upload({ opened, onClose, tab, onTabChange }: UploadModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap={6}>
          <Icon icon={tab === 'file' ? 'lucide:file' : 'lucide:github'} height={18} />
          <Text fw={600}>{tab === 'file' ? 'Upload Files' : 'Repositories'}</Text>
        </Group>
      }
      size="lg"
    >
      <Tabs value={tab} onChange={(val) => onTabChange(val as 'file' | 'repo')}>
        <Tabs.List mb="md">
          <Tabs.Tab value="file" leftSection={<Icon icon="lucide:file" height={16} />}>
            Files
          </Tabs.Tab>
          <Tabs.Tab value="repo" leftSection={<Icon icon="lucide:github" height={16} />}>
            Repositories
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="file">
          <FileTab onClose={onClose} />
        </Tabs.Panel>

        <Tabs.Panel value="repo">
          <RepoTab onClose={onClose} />
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}

// --- Menu Items ---

export function FileMenuItem({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Menu.Item
      leftSection={<Icon icon="lucide:file" height={18} />}
      onClick={onClick}
      disabled={disabled}
    >
      File
    </Menu.Item>
  );
}

export function RepositoryMenuItem({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Menu.Item
      leftSection={<Icon icon="lucide:github" height={18} />}
      onClick={onClick}
      disabled={disabled}
    >
      Repository
    </Menu.Item>
  );
}

export function ScreenshotMenuItem({ disabled }: { disabled?: boolean }) {
  // Check for support
  const [supported] = useState(() => {
    if (typeof window === 'undefined') return false;
    const isTauriEnv = window.__TAURI__ !== undefined;
    const hasMediaDevices =
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      'getDisplayMedia' in navigator.mediaDevices;
    return hasMediaDevices && !isTauriEnv;
  });

  const captureScreenshot = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
      });
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx!.drawImage(video, 0, 0);
      stream.getTracks().forEach((track) => track.stop());

      canvas.toBlob((blob) => {
        if (blob) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const file = new File([blob], `screenshot-${timestamp}.png`, { type: 'image/png' });
          void uploadFiles([file]);
        }
      }, 'image/png');
    } catch (e) {
      console.error('Failed to capture screenshot:', e);
    }
  }, []);

  if (!supported) return null;

  return (
    <Menu.Item
      disabled={disabled}
      leftSection={<Icon icon="lucide:screen-share" height={18} />}
      onClick={() => void captureScreenshot()}
    >
      Screenshot
    </Menu.Item>
  );
}
