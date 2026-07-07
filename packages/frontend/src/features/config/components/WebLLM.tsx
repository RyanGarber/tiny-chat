import { ActionIcon, Box, Card, Group, Input, Modal, Progress, Stack, Text } from '@mantine/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { WebLLMConfig, WebLLMProvider } from '@/features/config/services/WebLLMProvider.ts';
import { auth } from '@/utils/api.ts';
import { GLASS_STYLE } from '@/utils/theme.ts';
import { Icon } from '@iconify/react';
import { deleteModelInCache, hasModelInCache, ModelRecord, ModelType } from '@mlc-ai/web-llm';
import { WebLLMEmbeddingModel, WebLLMLanguageModel } from '@browser-ai/web-llm';

export default function WebLLM({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const session = auth.useSession();

  const models = useQuery({
    queryKey: ['webllm'] as const,
    queryFn: async () => {
      const models: (ModelRecord & { cached: boolean })[] = [];
      for (const model of WebLLMConfig.model_list) {
        models.push({
          ...model,
          cached: await hasModelInCache(model.model_id),
        });
      }
      return models;
    },
  });

  const [query, setQuery] = useState<string>('');
  const filteredModels = useMemo(
    () =>
      models.data?.filter(
        (m) => !query || m.model_id.toLowerCase().includes(query.toLowerCase()),
      ) ?? [],
    [models.data, query],
  );

  const [downloads, setDownloads] = useState<Record<string, number>>({});
  const downloadModel = useMutation({
    mutationFn: async (modelName: string) => {
      await (
        WebLLMProvider.getClientGenerateModel(session.data!.user, modelName, import.meta.env) as
          | WebLLMLanguageModel
          | WebLLMEmbeddingModel
      ).createSessionWithProgress((progress) => {
        setDownloads((prev) => ({
          ...prev,
          [modelName]: typeof progress === 'number' ? progress : progress.progress,
        }));
      });
    },
    onSuccess: async () => {
      await models.refetch();
    },
  });

  const deleteModel = useMutation({
    mutationFn: async (modelName: string) => {
      await deleteModelInCache(modelName);
    },
    onSuccess: async () => {
      await models.refetch();
    },
  });

  return (
    <Modal title="Native Models" opened={opened} onClose={onClose} size="lg">
      <Stack>
        <Input
          placeholder="Search models"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {filteredModels?.map((m, i) => (
          <Card key={i} style={{ ...GLASS_STYLE }}>
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
                    {m.model_id}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {m.model_type === ModelType.embedding ? 'Embedding' : 'Chat'}
                    {m.overrides?.context_window_size && ` · ${m.overrides.context_window_size}`}
                    {m.vram_required_MB && ` · ${(m.vram_required_MB / 1024).toFixed(1)} GB`}
                  </Text>
                </Box>
                <Box>
                  {downloadModel.error && downloadModel.variables === m.model_id && (
                    <Text size="xs" c="red">
                      {String(downloadModel.error)}
                    </Text>
                  )}
                  {m.cached ? (
                    <ActionIcon
                      color="red"
                      onClick={() => deleteModel.mutate(m.model_id)}
                      loading={deleteModel.isPending && deleteModel.variables === m.model_id}
                      disabled={deleteModel.isPending && deleteModel.variables === m.model_id}
                    >
                      <Icon icon="lucide:trash" />
                    </ActionIcon>
                  ) : (
                    <ActionIcon
                      onClick={() => downloadModel.mutate(m.model_id)}
                      loading={downloadModel.isPending && downloadModel.variables === m.model_id}
                      disabled={downloadModel.isPending && downloadModel.variables === m.model_id}
                    >
                      <Icon icon="lucide:download" />
                    </ActionIcon>
                  )}
                </Box>
              </Group>
              {downloadModel.isPending && downloadModel.variables === m.model_id && (
                <Progress value={downloads[m.model_id] * 100} />
              )}
            </Stack>
          </Card>
        ))}
      </Stack>
    </Modal>
  );
}
