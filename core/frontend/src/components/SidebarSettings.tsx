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
import { JSX, useEffect, useRef, useState } from 'react';
import { useProviders } from '@/stores/providers.tsx';
import { codeThemes, themes, useSettings } from '@/stores/settings.tsx';
import { hashText } from '@/utils/text';
import { consumeLabel } from '@/utils/ui';
import { useDisclosure } from '@mantine/hooks';
import { useLayout } from '@/stores/layout.tsx';
import {
  ChatProviderStatus,
  OtherProviderStatus,
  SearchProviderStatus,
  zConfig,
} from '@tiny-chat/core-backend/src/types.ts';
import ModelSelect from '@/components/ModelSelect.tsx';
import { Icon } from '@iconify/react';
import Console from '@/components/Console.tsx';

export default function SidebarSettings({
  children,
}: {
  children: (open: () => void) => JSX.Element;
}) {
  const {
    getInstructions,
    addInstruction,
    editInstruction,
    removeInstruction,
    getEmbeddingConfig,
    setEmbeddingConfig,
    getUseEmbeddingSearch,
    setUseEmbeddingSearch,
    getTheme,
    setTheme,
    getCodeTheme,
    setCodeTheme,
    getProviderSetting,
    setProviderSetting,
  } = useSettings();

  const { chatProviders, searchProviders, otherProviders, updateProviders } = useProviders();
  const { setGestureBlock, setDrawerCloser } = useLayout();

  const codeThemeRef = useRef<HTMLInputElement>(null);

  const [opened, { open, close }] = useDisclosure(false);

  const [addingInstruction, setAddingInstruction] = useState(false);
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

  const ProviderSettings = (providers: (ChatProviderStatus | SearchProviderStatus | OtherProviderStatus)[]) => (
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
                  defaultValue={getProviderSetting(provider.name, s) ?? ''}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  onBlur={(e) => {
                    if (e.target.value === (getProviderSetting(provider.name, s) ?? '')) return;
                    void setProviderSetting(provider.name, s, e.target.value);
                  }}
                />
              ))}
            </Stack>
          </Box>
        ))}
    </Stack>
  );

  const [consoleOpened, { open: openConsole, close: closeConsole }] = useDisclosure(false);

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
        <Tabs defaultValue="general">
          <Tabs.List mb="lg">
            <Tabs.Tab value="general" leftSection={<Icon icon="lucide:settings-2" height={18} />}>
              General
            </Tabs.Tab>
            <Tabs.Tab value="appearance" leftSection={<Icon icon="lucide:image" height={18} />}>
              Appearance
            </Tabs.Tab>
            <Tabs.Tab value="apiKeys" leftSection={<Icon icon="lucide:key-round" height={18} />}>
              API Keys
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="general">
            <Stack>
              <Box>
                <Text size="sm">Instructions</Text>
                <Text size="xs" c="dimmed">
                  Shapes model responses
                </Text>
              </Box>
              {getInstructions().map((instruction, index) => (
                <Textarea
                  key={hashText(index + instruction)}
                  defaultValue={instruction}
                  autosize
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  onBlur={(e) => {
                    if (e.target.value === instruction) return;
                    if (e.target.value) {
                      void editInstruction(index, e.target.value);
                    } else {
                      void removeInstruction(index);
                    }
                  }}
                  leftSection={
                    <Text c="dimmed" size="xs">
                      {index + 1}
                    </Text>
                  }
                  rightSection={
                    <ActionIcon
                      variant="subtle"
                      onClick={() => {
                        void removeInstruction(index);
                      }}
                    >
                      <Icon icon="lucide:trash" height={18} />
                    </ActionIcon>
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
                    void (async () => {
                      if (!e.target.value) return;
                      setAddingInstruction(true);
                      await addInstruction(e.target.value);
                      setAddingInstruction(false);
                      e.target.value = '';
                    })();
                  }}
                  disabled={addingInstruction}
                />
              </Tooltip>
              <Space />
              <Box>
                <Text size="sm">Embeddings</Text>
                <Text size="xs" c="dimmed">
                  Enables memory and smart search
                </Text>
              </Box>
              <Tooltip label="Model that generates embeddings" color="gray" position="right">
                <ModelSelect
                  label="Embedding Model"
                  styles={consumeLabel}
                  optional
                  configValue={getEmbeddingConfig()}
                  onConfigChange={(value) => {
                    setEmbedChange(value ?? null);
                    openEmbedConfirm();
                  }}
                  feature={'embed'}
                />
              </Tooltip>
              <Modal
                title="Change Embedding Model"
                opened={isEmbedConfirmOpen}
                onClose={closeEmbedding}
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
                    void setEmbeddingConfig(embedChange ?? undefined);
                    closeEmbedding();
                  }}
                  mt="lg"
                >
                  Confirm
                </Button>
              </Modal>
              <Tooltip
                label={
                  getEmbeddingConfig()
                    ? 'Considers semantic meaning of text'
                    : 'Requires embedding model'
                }
                color="gray"
                position="right"
              >
                <CheckboxCard
                  p="xs"
                  checked={getUseEmbeddingSearch()}
                  onChange={(value) => {
                    void setUseEmbeddingSearch(value);
                  }}
                  disabled={!getEmbeddingConfig()}
                  style={{ cursor: !getEmbeddingConfig() ? 'not-allowed' : 'pointer' }}
                >
                  <Group>
                    <CheckboxIndicator size="xs" disabled={!getEmbeddingConfig()} />
                    <Text size="sm">Smart Search</Text>
                  </Group>
                </CheckboxCard>
              </Tooltip>
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="appearance">
            <Stack>
              <Box>
                <Text size="sm">Themes</Text>
                <Text size="xs" c="dimmed">
                  Changes the look of the app
                </Text>
              </Box>
              <Tooltip label="Styles the app" color="gray" position="right">
                <Select
                  label="App Theme"
                  styles={consumeLabel}
                  allowDeselect={false}
                  data={themes}
                  value={getTheme()}
                  onChange={(value) => {
                    if (!value) return;
                    void setTheme(value);
                  }}
                ></Select>
              </Tooltip>
              <Tooltip label="Styles code blocks" color="gray" position="right">
                <Select
                  label="Code Theme"
                  styles={consumeLabel}
                  allowDeselect={false}
                  data={codeThemes(getTheme())}
                  value={getCodeTheme()}
                  onChange={(value) => {
                    if (!value) return;
                    void setCodeTheme(value);
                  }}
                  ref={codeThemeRef}
                />
              </Tooltip>
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="apiKeys">
            <Stack>
              <Group justify="space-between">
                <Box>
                  <Text size="sm">Models</Text>
                  <Text size="xs" c="dimmed">
                    Handles chats and embeddings
                  </Text>
                </Box>
                <ActionIcon variant="transparent" c="dimmed" onClick={() => void updateProviders()}>
                  <Icon icon="lucide:rotate-ccw" />
                </ActionIcon>
              </Group>
              {ProviderSettings(chatProviders)}
              <Space />
              <Box>
                <Text size="sm">Search</Text>
                <Text size="xs" c="dimmed">
                  Enables models to search the web
                </Text>
              </Box>
              {ProviderSettings(searchProviders)}
              {otherProviders.filter((p) => p.settings.length > 0).length > 0 && (
                <>
                  <Space />
                  <Box>
                    <Text size="sm">Other</Text>
                    <Text size="xs" c="dimmed">
                      Additional integrations
                    </Text>
                  </Box>
                  {ProviderSettings(otherProviders)}
                </>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Drawer>
    </>
  );
}
