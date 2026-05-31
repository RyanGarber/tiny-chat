import { ActionIcon, Box, Card, Group, Input, Modal, Progress, Stack, Text } from '@mantine/core';
import { listModels } from '@huggingface/hub';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { glassStyle } from '@/utils/glass';
import {
  deleteModelCache,
  HuggingFaceProvider,
  getModelCacheSize,
} from '../../providers/huggingface';
import { auth } from '@/utils/api';
import { TransformersJSLanguageModel } from '@browser-ai/transformers-js';
import { Icon } from '@iconify/react';
import { format } from 'timeago.js';
import { useHuggingFaceSettings } from '@/features/settings/hooks/useHuggingFaceSettings';

interface Model {
  name: string;
  task?: string;
  downloads?: number;
  updatedAt?: Date;
  cacheSize: number | null;
}

export default function HuggingFace({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const session = auth.useSession();
  const { huggingFaceModels, setHuggingFaceModels } = useHuggingFaceSettings();

  const savedModels = useQuery({
    queryKey: ['huggingface', 'models', huggingFaceModels.data] as const,
    queryFn: async () => {
      const models: Model[] = [];
      for (const model of huggingFaceModels.data ?? []) {
        models.push({
          name: model,
          cacheSize: await getModelCacheSize(model),
        });
      }
      return models;
    },
  });

  const [query, setQuery] = useState<string>('');

  const searchedModels = useQuery({
    queryKey: ['huggingface', query] as const,
    queryFn: async () => {
      if (!query) return [];
      const result = listModels({
        search: {
          query,
          tags: ['transformers.js'],
        },
        limit: 10,
      });
      const models: Model[] = [];
      for await (const model of result) {
        models.push({
          name: model.name,
          task: model.task,
          downloads: model.downloads,
          updatedAt: model.updatedAt,
          cacheSize: await getModelCacheSize(model.name),
        });
      }
      return models;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const [downloads, setDownloads] = useState<Record<string, number>>({});
  const downloadModel = useMutation({
    mutationFn: async (modelName: string) => {
      if (!huggingFaceModels.data?.includes(modelName)) {
        setHuggingFaceModels.mutate(
          {
            huggingFaceModels: [...(huggingFaceModels.data ?? []), modelName],
          },
          { onSuccess: () => void savedModels.refetch() },
        );
      }
      await (
        HuggingFaceProvider.getClientModel(
          session.data!.user,
          modelName,
          import.meta.env,
        ) as TransformersJSLanguageModel
      ).createSessionWithProgress((progress) => {
        setDownloads((prev) => ({ ...prev, [modelName]: progress }));
      });
    },
  });

  const deleteModel = useMutation({
    mutationFn: async (modelName: string) => {
      await deleteModelCache(modelName);
      setHuggingFaceModels.mutate(
        {
          huggingFaceModels: huggingFaceModels.data?.filter((m) => m !== modelName) ?? [],
        },
        { onSuccess: () => void savedModels.refetch() },
      );
    },
  });

  return (
    <Modal title="Hugging Face" opened={opened} onClose={onClose} size="lg">
      <Stack>
        <Input
          placeholder="Search models"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {(query ? searchedModels.data : savedModels.data)?.map((m, i) => (
          <Card key={i} style={{ ...glassStyle }}>
            <Stack>
              <Group justify="space-between">
                <Box flex={1} miw={0}>
                  <Text
                    size="sm"
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {m.name}
                  </Text>
                  {m.task && (
                    <Text size="xs" c="dimmed">
                      {m.task ?? 'unknown'} &middot; {Number(m.downloads).toLocaleString()}{' '}
                      downloads &middot; {format(m.updatedAt!).replace(' ago', '')}
                    </Text>
                  )}
                  {m.cacheSize !== null && (
                    <Text size="xs" c="dimmed">
                      {m.cacheSize} files on disk
                    </Text>
                  )}
                </Box>
                <Box>
                  {downloadModel.error && (
                    <Text size="xs" c="red">
                      {String(downloadModel.error)}
                    </Text>
                  )}
                  {m.cacheSize ? (
                    <ActionIcon
                      color="red"
                      onClick={() => deleteModel.mutate(m.name)}
                      loading={deleteModel.isPending && deleteModel.variables === m.name}
                      disabled={deleteModel.isPending && deleteModel.variables === m.name}
                    >
                      <Icon icon="lucide:trash" />
                    </ActionIcon>
                  ) : (
                    <ActionIcon
                      onClick={() => downloadModel.mutate(m.name)}
                      loading={downloadModel.isPending && downloadModel.variables === m.name}
                      disabled={downloadModel.isPending && downloadModel.variables === m.name}
                    >
                      <Icon icon="lucide:download" />
                    </ActionIcon>
                  )}
                </Box>
              </Group>
              {downloadModel.isPending && downloadModel.variables === m.name && (
                <Progress value={downloads[m.name]} />
              )}
            </Stack>
          </Card>
        ))}
      </Stack>
    </Modal>
  );
}
