import {
  ActionIcon,
  Box,
  Button,
  CheckboxCard,
  CheckboxIndicator,
  Drawer,
  Group,
  Modal,
  Progress,
  Select,
  Space,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { JSX, useEffect, useMemo, useState } from 'react';
import { hashText } from '@/utils/data.ts';
import { useDisclosure } from '@mantine/hooks';
import { useLayoutStore } from '@/core/stores/useLayoutStore';
import { zCache } from '@tiny-chat/shared/src/types/user.ts';
import { zConfig } from '@tiny-chat/shared/src/types/chat.ts';
import ModelSelect, { ModelMultiSelect } from '@/features/config/components/ModelSelect.tsx';
import { Icon } from '@iconify/react';
import Console from '@/core/components/Console';
import { useHiddenModels } from '@/features/settings/hooks/useHiddenModels';
import { useInstructions } from '@/features/settings/hooks/useInstructions';
import { useRetrieval } from '@/features/settings/hooks/useRetrieval';
import { useProviderSettings } from '@/features/settings/hooks/useProviderSettings';
import { useThemes } from '@/features/settings/hooks/useThemes';
import { providerCacheMutationKey, useProviders } from '@/features/config/hooks/useProviders.ts';
import { codeThemesByTheme, GLASS_STYLE, INPUT_STYLE, THEMES } from '@/utils/theme';
import { useIsMutating, useMutationState } from '@tanstack/react-query';
import {
  runEmbeddingBatchMutationKey,
  useEmbedding,
} from '@/features/config/hooks/useEmbedding.ts';

export default function SidebarSettings({
  children,
}: {
  children: (open: () => void) => JSX.Element;
}) {
  const { providers, updateProviders } = useProviders();
  const setGestureBlock = useLayoutStore((s) => s.setGestureBlock);
  const setDrawerCloser = useLayoutStore((s) => s.setDrawerCloser);

  const [opened, { open, close }] = useDisclosure(false);

  const [embedChange, setEmbedChange] = useState<zConfig | null>(null);
  const [isEmbedConfirmOpen, { open: openEmbedConfirm, close: closeEmbedding }] =
    useDisclosure(false);

  // Modals fully block swipe gestures
  useEffect(() => {
    setGestureBlock(isEmbedConfirmOpen);
  }, [isEmbedConfirmOpen, setGestureBlock]);

  // Drawers intercept swipe-to-close so it closes the drawer before the sidebar
  useEffect(() => {
    if (opened) {
      setDrawerCloser(close);
      return () => setDrawerCloser(null);
    }
  }, [opened, close, setDrawerCloser]);

  const [consoleOpened, { open: openConsole, close: closeConsole }] = useDisclosure(false);
  const { hiddenModels, setHiddenModels } = useHiddenModels();
  const { instructions, addInstruction, editInstruction, removeInstruction } = useInstructions();
  const { embeddingConfig, setEmbeddingConfig, useEmbeddingSearch, setUseEmbeddingSearch } =
    useRetrieval();
  const {
    providerSettings,
    setProviderSetting,
    preferredWebProvider,
    setPreferredWebProvider,
    useProviderCache,
    setUseProviderCache,
    useBrowserModels,
    setUseBrowserModels,
  } = useProviderSettings();
  const { theme, setTheme, codeTheme, setCodeTheme } = useThemes();

  const { nextEmbeddingBatch } = useEmbedding();
  const embeddingMutationStatus =
    useMutationState({
      filters: { mutationKey: runEmbeddingBatchMutationKey },
      select: (m) => m.state.status,
    }).at(-1) ?? 'idle';
  const runEmbeddingBatch = {
    isIdle: embeddingMutationStatus === 'idle',
    isPending: embeddingMutationStatus === 'pending',
    isError: embeddingMutationStatus === 'error',
    isSuccess: embeddingMutationStatus === 'success',
  };
  const { batchCount, totalCount } = useMemo(() => {
    return {
      batchCount:
        (nextEmbeddingBatch.data?.messages.length ?? 0) +
        (nextEmbeddingBatch.data?.memories.length ?? 0) +
        (nextEmbeddingBatch.data?.files.length ?? 0),
      totalCount:
        Number(nextEmbeddingBatch.data?.messages[0]?.total ?? 0) +
        Number(nextEmbeddingBatch.data?.memories[0]?.total ?? 0) +
        Number(nextEmbeddingBatch.data?.files[0]?.total ?? 0),
    };
  }, [nextEmbeddingBatch.data]);

  const ProviderSettings = (providers: zCache['providers']['chat' | 'web' | 'other']) => (
    <Stack>
      {providers
        .filter((s) => s.settings.length)
        .map((provider) => (
          <Box
            key={provider.name}
            style={
              provider.error
                ? {
                    border: '1px solid var(--mantine-color-red-6)',
                    borderRadius: 'var(--mantine-radius-md)',
                    padding: 'var(--mantine-spacing-xs)',
                  }
                : undefined
            }
          >
            <Group justify="space-between">
              <Text size="sm">{provider.name}</Text>
              {provider.error && (
                <Text size="xs" c="red">
                  {provider.error}
                </Text>
              )}
            </Group>
            <Stack mt={5}>
              {provider.settings.map((s) => (
                <TextInput
                  key={provider.name + s}
                  label={s}
                  styles={INPUT_STYLE}
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                  defaultValue={providerSettings.data?.[provider.name]?.[s] ?? ''}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  onBlur={(e) => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    if (e.target.value === (providerSettings.data?.[provider.name]?.[s] ?? ''))
                      return;
                    setProviderSetting.mutate({
                      provider: provider.name,
                      key: s,
                      value: e.target.value,
                    });
                  }}
                  disabled={
                    setProviderSetting.isPending &&
                    setProviderSetting.variables.provider === provider.name &&
                    setProviderSetting.variables.key === s
                  }
                  readOnly={
                    setProviderSetting.isPending &&
                    setProviderSetting.variables.provider === provider.name &&
                    setProviderSetting.variables.key === s
                  }
                />
              ))}
            </Stack>
          </Box>
        ))}
    </Stack>
  );

  const areProvidersUpdating = useIsMutating({ mutationKey: providerCacheMutationKey }) > 0;

  return (
    <>
      {children(open)}
      <Console opened={consoleOpened} onClose={closeConsole} />
      <Drawer
        opened={opened}
        onClose={close}
        title={
          <Group gap={5}>
            Settings{' '}
            <ActionIcon variant="transparent" c="dimmed" onClick={openConsole}>
              <Icon icon="lucide:logs" />
            </ActionIcon>
          </Group>
        }
      >
        <Tabs defaultValue="app" variant="pills">
          <Tabs.List mb="lg">
            <Tabs.Tab value="app" leftSection={<Icon icon="lucide:settings-2" height={18} />}>
              App
            </Tabs.Tab>
            <Tabs.Tab value="chat" leftSection={<Icon icon="lucide:message-circle" height={18} />}>
              Chat
            </Tabs.Tab>
            <Tabs.Tab value="keys" leftSection={<Icon icon="lucide:key-round" height={18} />}>
              Keys
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="app">
            <Stack>
              <Box>
                <Text size="sm">Appearance</Text>
                <Text size="xs" c="dimmed">
                  Changes the look of the app
                </Text>
              </Box>
              <Tooltip label="Styles the app" color="gray" position="right">
                <Select
                  label="App Theme"
                  styles={INPUT_STYLE}
                  allowDeselect={false}
                  data={THEMES}
                  value={theme.data}
                  onChange={(value) => {
                    if (!value) return;
                    setTheme.mutate({ theme: value });
                  }}
                  disabled={setTheme.isPending}
                  readOnly={setTheme.isPending}
                ></Select>
              </Tooltip>
              <Tooltip label="Styles code blocks" color="gray" position="right">
                <Select
                  label="Code Theme"
                  styles={INPUT_STYLE}
                  allowDeselect={false}
                  data={codeThemesByTheme(theme.data)}
                  value={codeTheme.data}
                  onChange={(value) => {
                    if (!value) return;
                    setCodeTheme.mutate({ codeTheme: value });
                  }}
                  disabled={setCodeTheme.isPending}
                  readOnly={setCodeTheme.isPending}
                />
              </Tooltip>
              <Space />
              <Box>
                <Text size="sm">Performance</Text>
                <Text size="xs" c="dimmed">
                  Optimizes performance of the app
                </Text>
              </Box>
              <Tooltip label="Reuse model lists for faster loading" color="gray" position="right">
                <CheckboxCard
                  p="xs"
                  checked={useProviderCache.data}
                  onChange={(value) => {
                    setUseProviderCache.mutate({ useProviderCache: value });
                  }}
                >
                  <Group>
                    <CheckboxIndicator size="xs" />
                    <Text size="sm">Provider Cache</Text>
                  </Group>
                </CheckboxCard>
              </Tooltip>
              <Tooltip
                label="Disable WebLLM support for faster loading"
                color="gray"
                position="right"
              >
                <CheckboxCard
                  p="xs"
                  checked={!useBrowserModels.data}
                  onChange={(value) => setUseBrowserModels.mutate({ useBrowserModels: !value })}
                >
                  <Group>
                    <CheckboxIndicator size="xs" />
                    <Text size="sm">No Native Provider</Text>
                  </Group>
                </CheckboxCard>
              </Tooltip>
              <Space />
              <Box>
                <Text size="sm">Preferred Models</Text>
                <Text size="xs" c="dimmed">
                  Determines the models shown in the app
                </Text>
              </Box>
              <Stack>
                <Tooltip label="Generative models to show" color="gray" position="right">
                  <ModelMultiSelect
                    label="Generation"
                    styles={INPUT_STYLE}
                    feature="generate"
                    configValues={hiddenModels.data?.generate.map((m) => zConfig.parse(m)) ?? []}
                    onConfigChange={(value) =>
                      setHiddenModels.mutate({ feature: 'generate', models: value })
                    }
                    includeHidden
                    invert
                  />
                </Tooltip>
                <Tooltip label="Embedding models to show" color="gray" position="right">
                  <ModelMultiSelect
                    label="Embedding"
                    styles={INPUT_STYLE}
                    feature="embed"
                    configValues={hiddenModels.data?.embed.map((m) => zConfig.parse(m)) ?? []}
                    onConfigChange={(value) =>
                      setHiddenModels.mutate({ feature: 'embed', models: value })
                    }
                    includeHidden
                    invert
                  />
                </Tooltip>
              </Stack>
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="chat">
            <Stack>
              <Box>
                <Text size="sm">Instructions</Text>
                <Text size="xs" c="dimmed">
                  Shapes model responses
                </Text>
              </Box>
              {instructions.data?.map((instruction, index) => (
                <Textarea
                  key={hashText(index + instruction)}
                  defaultValue={instruction}
                  autosize
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  onBlur={(e) => {
                    if (e.target.value === instruction) return;
                    if (e.target.value)
                      editInstruction.mutate({ index, instruction: e.target.value });
                    else removeInstruction.mutate({ index });
                  }}
                  leftSection={
                    <Text c="dimmed" size="xs">
                      {index + 1}
                    </Text>
                  }
                  rightSection={
                    <ActionIcon
                      variant="subtle"
                      onClick={() => removeInstruction.mutate({ index })}
                      disabled={
                        removeInstruction.isPending && removeInstruction.variables.index === index
                      }
                    >
                      <Icon icon="lucide:trash" height={18} />
                    </ActionIcon>
                  }
                  disabled={
                    (editInstruction.isPending && editInstruction.variables.index === index) ||
                    (removeInstruction.isPending && removeInstruction.variables.index === index)
                  }
                />
              ))}
              <Tooltip label="System instructions for models" color="gray" position="right">
                <Textarea
                  key="add"
                  autosize
                  label="Instruction"
                  styles={{
                    ...(INPUT_STYLE as Record<string, unknown>),
                    ...{ input: { paddingTop: 25 } },
                  }}
                  placeholder="Keep responses short."
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  onBlur={(e) => {
                    if (!e.target.value) return;
                    addInstruction.mutate({ instruction: e.target.value });
                    e.target.value = '';
                  }}
                  disabled={addInstruction.isPending}
                />
              </Tooltip>
              <Space />
              <Box>
                <Text size="sm">Retrieval</Text>
                <Text size="xs" c="dimmed">
                  Enables memory and smart search
                  {totalCount > 0 && ` (${totalCount.toLocaleString()})`}
                </Text>
                {totalCount > 0 && (
                  <Progress
                    my={5}
                    value={
                      runEmbeddingBatch.isError
                        ? 100
                        : runEmbeddingBatch.isIdle
                          ? 0
                          : Math.min(100, (batchCount / totalCount) * 100)
                    }
                    color={
                      runEmbeddingBatch.isError
                        ? 'red'
                        : runEmbeddingBatch.isIdle
                          ? 'gray'
                          : undefined
                    }
                    animated={runEmbeddingBatch.isPending}
                  />
                )}
              </Box>
              <Tooltip label="Model that generates embeddings" color="gray" position="right">
                <ModelSelect
                  label="Embedding Model"
                  styles={INPUT_STYLE}
                  optional
                  configValue={embeddingConfig.data}
                  onConfigChange={(value) => {
                    setEmbedChange(value ?? null);
                    openEmbedConfirm();
                  }}
                  feature="embed"
                  disabled={isEmbedConfirmOpen || setEmbeddingConfig.isPending}
                  readOnly={isEmbedConfirmOpen || setEmbeddingConfig.isPending}
                />
              </Tooltip>
              <Modal
                title="Change Embedding Model"
                opened={isEmbedConfirmOpen}
                onClose={closeEmbedding}
                styles={{ content: GLASS_STYLE }}
                centered
              >
                {embedChange ? (
                  <Text>
                    All embeddings will be regenerated using the model{' '}
                    <strong>{embedChange.model}</strong>.
                  </Text>
                ) : (
                  <Text>Features like memory and smart search will not be available.</Text>
                )}
                <Button
                  variant="gradient"
                  fullWidth
                  onClick={() => {
                    setEmbeddingConfig.mutate({ config: embedChange });
                    closeEmbedding();
                  }}
                  mt="lg"
                  disabled={setEmbeddingConfig.isPending}
                  loading={setEmbeddingConfig.isPending}
                >
                  Confirm
                </Button>
              </Modal>
              <Tooltip
                label={
                  embeddingConfig.data
                    ? 'Considers semantic meaning of text'
                    : 'Requires embedding model'
                }
                color="gray"
                position="right"
              >
                <CheckboxCard
                  p="xs"
                  checked={useEmbeddingSearch.data}
                  onChange={(value) => {
                    setUseEmbeddingSearch.mutate({ useEmbeddingSearch: value });
                  }}
                  disabled={!embeddingConfig.data || setUseEmbeddingSearch.isPending}
                  style={{
                    cursor: !embeddingConfig.data ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Group>
                    <CheckboxIndicator size="xs" />
                    <Text size="sm">Smart Search</Text>
                  </Group>
                </CheckboxCard>
              </Tooltip>
              <Space />
              <Box>
                <Text size="sm">Web</Text>
                <Text size="xs" c="dimmed">
                  Enables web browsing for chat models
                </Text>
              </Box>
              <Tooltip label="Provider used for web browsing" color="gray" position="right">
                <Select
                  label="Preferred Provider"
                  styles={INPUT_STYLE}
                  allowDeselect={false}
                  data={providers.data?.web.filter((p) => p.available).map((p) => p.name) ?? []}
                  value={preferredWebProvider.data}
                  onChange={(value) => {
                    if (!value) return;
                    setPreferredWebProvider.mutate({ preferredWebProvider: value });
                  }}
                  disabled={setPreferredWebProvider.isPending}
                  readOnly={setPreferredWebProvider.isPending}
                />
              </Tooltip>
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="keys">
            <Stack>
              <Group justify="space-between">
                <Box>
                  <Text size="sm">Chat</Text>
                  <Text size="xs" c="dimmed">
                    Access chat and embedding models
                  </Text>
                </Box>
                <Tooltip label="Check for new models" color="gray" position="right">
                  <ActionIcon
                    variant="transparent"
                    c="dimmed"
                    onClick={() => updateProviders.mutate()}
                    loading={setProviderSetting.isPending || areProvidersUpdating}
                    disabled={setProviderSetting.isPending || areProvidersUpdating}
                  >
                    <Icon icon="lucide:refresh-cw" />
                  </ActionIcon>
                </Tooltip>
              </Group>
              {ProviderSettings(providers.data?.chat ?? [])}
              <Space />
              <Box>
                <Text size="sm">Web</Text>
                <Text size="xs" c="dimmed">
                  Enable web browsing for chat models
                </Text>
              </Box>
              {ProviderSettings(providers.data?.web ?? [])}
              {(providers.data?.other?.filter((p) => p.settings.length > 0).length ?? 0) > 0 && (
                <>
                  <Space />
                  <Box>
                    <Text size="sm">Other</Text>
                    <Text size="xs" c="dimmed">
                      Enable extra features and integrations
                    </Text>
                  </Box>
                  {ProviderSettings(providers.data?.other ?? [])}
                </>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Drawer>
    </>
  );
}
