import {
  ActionIcon,
  Box,
  Button,
  CheckboxCard,
  CheckboxIndicator,
  Drawer,
  Group,
  Modal,
  Select,
  Space,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { JSX, useEffect, useState } from 'react';
import { hashText } from '@/utils/text';
import { consumeLabel } from '@/utils/ui';
import { useDisclosure } from '@mantine/hooks';
import { useLayout } from '@/stores/layout.tsx';
import { zCache } from '@tiny-chat/shared/src/types/user.ts';
import { zConfig } from '@tiny-chat/shared/src/types/chat.ts';
import ModelSelect, { ModelMultiSelect } from '@/features/input/components/ModelSelect';
import { Icon } from '@iconify/react';
import Console from '@/core/components/Console';
import { glassStyle } from '@/utils/glass';
import { usePreferredModels } from '@/features/settings/hooks/usePreferredModels';
import { useInstructions } from '@/features/settings/hooks/useInstructions';
import { useRetrieval } from '@/features/settings/hooks/useRetrieval';
import { useProviderSettings } from '@/features/settings/hooks/useProviderSettings';
import { useThemes } from '@/features/settings/hooks/useThemes';
import { useProviders } from '@/features/input/hooks/useProviders';
import { codeThemesByTheme, THEMES } from '@/utils/theme';
import { useIsMutating } from '@tanstack/react-query';
import { query } from '@/utils/api';

export default function SidebarSettings({
  children,
}: {
  children: (open: () => void) => JSX.Element;
}) {
  const { providers, updateProviders } = useProviders();
  const setGestureBlock = useLayout((s) => s.setGestureBlock);
  const setDrawerCloser = useLayout((s) => s.setDrawerCloser);

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
  const { preferredModels, setPreferredModels } = usePreferredModels();
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
  } = useProviderSettings();
  const { theme, setTheme, codeTheme, setCodeTheme } = useThemes();

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
            <Text size="sm">{provider.name}</Text>
            <Stack mt={5}>
              {provider.settings.map((s) => (
                <TextInput
                  key={provider.name + s}
                  label={s}
                  styles={consumeLabel}
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

  const areProvidersUpdating =
    useIsMutating({ mutationKey: query.persistence.updateCache.mutationKey() }) > 0;

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
        <Tabs defaultValue="app">
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
                  styles={consumeLabel}
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
                  styles={consumeLabel}
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
                <Text size="sm">Preferences</Text>
                <Text size="xs" c="dimmed">
                  Changes the models shown in menus
                </Text>
              </Box>
              <Stack>
                <Tooltip label="Models shown in chat options" color="gray" position="right">
                  <ModelMultiSelect
                    label="Generation"
                    styles={consumeLabel}
                    feature="generate"
                    configValue={preferredModels.data?.generate ?? []}
                    onConfigChange={(value) =>
                      setPreferredModels.mutate({ feature: 'generate', models: value })
                    }
                  />
                </Tooltip>
                <Tooltip label="Models shown in embedding options" color="gray" position="right">
                  <ModelMultiSelect
                    label="Embedding"
                    styles={consumeLabel}
                    feature="embed"
                    configValue={preferredModels.data?.embed ?? []}
                    onConfigChange={(value) =>
                      setPreferredModels.mutate({ feature: 'embed', models: value })
                    }
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
                    ...(consumeLabel as Record<string, unknown>),
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
                </Text>
              </Box>
              <Tooltip label="Model that generates embeddings" color="gray" position="right">
                <ModelSelect
                  label="Embedding Model"
                  styles={consumeLabel}
                  optional
                  configValue={embeddingConfig.data}
                  onConfigChange={(value) => {
                    setEmbedChange(value ?? null);
                    openEmbedConfirm();
                  }}
                  feature="embed"
                  preferredOnly
                  disabled={isEmbedConfirmOpen || setEmbeddingConfig.isPending}
                  readOnly={isEmbedConfirmOpen || setEmbeddingConfig.isPending}
                />
              </Tooltip>
              <Modal
                title="Change Embedding Model"
                opened={isEmbedConfirmOpen}
                onClose={closeEmbedding}
                styles={{ content: glassStyle }}
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
                  styles={consumeLabel}
                  allowDeselect={false}
                  data={providers.data?.web.filter((p) => !p.error).map((p) => p.name)}
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
