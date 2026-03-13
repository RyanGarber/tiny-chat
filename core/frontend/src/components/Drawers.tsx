import {
  ActionIcon,
  Box,
  Button,
  CheckboxCard,
  CheckboxIndicator,
  Divider,
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
import { useProviders } from '@/managers/providers.tsx';
import { codeThemes, themes, useSettings } from '@/managers/settings.tsx';
import { auth, consumeLabel, hashText, openExternal, trpc, webUrl } from '@/utils.ts';
import { useDisclosure } from '@mantine/hooks';
import { useLayout } from '@/managers/layout.tsx';
import { zConfig } from '@tiny-chat/core-backend/src/types.ts';
import ModelSelect from '@/components/ModelSelect.tsx';
import { useTasks } from '@/managers/tasks.tsx';
import { Icon } from '@iconify/react';

export default function Drawers({
  buttons,
}: {
  buttons: (account: () => void, settings: () => void) => JSX.Element;
}) {
  const [isCloning, setCloning] = useState(false);

  const {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    accounts,
    linkAccount,
    unlinkAccount,
    deleteUser,
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
    getProviderError,
  } = useSettings();
  const { chatProviders, searchProviders } = useProviders();
  const { setGestureBlock, setDrawerCloser } = useLayout();

  const { data: session } = auth.useSession();

  const codeThemeRef = useRef<HTMLInputElement>(null);

  const provider = (id: string, name: string, icon: JSX.Element) => (
    <Group justify="space-between">
      <Group gap={5}>
        {icon}
        <Text>{name}</Text>
      </Group>
      {/* eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any */}
      {accounts.find((account: any) => account.providerId === id) ? (
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        accounts.length === 1 ? (
          <Tooltip label="Must have one account" color="gray">
            <Button variant="light" onClick={() => void unlinkAccount(id)} disabled>
              Unlink
            </Button>
          </Tooltip>
        ) : (
          <Button variant="light" onClick={() => void unlinkAccount(id)}>
            Unlink
          </Button>
        )
      ) : (
        <Button variant="default" onClick={() => void linkAccount(id)}>
          Link
        </Button>
      )}
    </Group>
  );

  const [accountsOpened, { open: openAccounts, close: closeAccounts }] = useDisclosure(false);
  const [settingsOpened, { open: openSettings, close: closeSettings }] = useDisclosure(false);

  const [addingInstruction, setAddingInstruction] = useState(false);
  const [embedChange, setEmbedChange] = useState<zConfig | null>(null);
  const [isEmbedConfirmOpen, { open: openEmbedConfirm, close: closeEmbedding }] = useDisclosure();
  const [isDeleteOpen, { open: openDelete, close: closeDelete }] = useDisclosure(false);

  // Modals fully block swipe gestures
  useEffect(() => {
    setGestureBlock(isDeleteOpen || isEmbedConfirmOpen);
  }, [isDeleteOpen, isEmbedConfirmOpen, setGestureBlock]);

  // Drawers intercept swipe-to-close so it closes the drawer before the sidebar
  useEffect(() => {
    if (accountsOpened) {
      setDrawerCloser(closeAccounts);
    } else if (settingsOpened) {
      setDrawerCloser(closeSettings);
    } else {
      setDrawerCloser(null);
    }
    return () => setDrawerCloser(null);
  }, [accountsOpened, closeAccounts, settingsOpened, closeSettings, setDrawerCloser]);

  const [cloneInterval, setCloneInterval] = useState<NodeJS.Timeout>();

  const ProviderSettings = (providers: { name: string; settings: string[] }[]) => (
    <Stack>
      {providers
        .filter((s) => s.settings.length)
        .map((service) => (
          <Box
            key={service.name}
            style={
              getProviderError(service.name)
                ? {
                    border: '1px solid var(--mantine-color-red-6)',
                    borderRadius: 'var(--mantine-radius-md)',
                    padding: 'var(--mantine-spacing-xs)',
                  }
                : undefined
            }
          >
            <Text size="sm">{service.name}</Text>
            <Stack mt={5}>
              {service.settings.map((s) => (
                <TextInput
                  key={service.name + s}
                  label={s}
                  styles={consumeLabel}
                  defaultValue={getProviderSetting(service.name, s) ?? ''}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  onBlur={(e) => {
                    if (e.target.value === (getProviderSetting(service.name, s) ?? '')) return;
                    void setProviderSetting(service.name, s, e.target.value);
                  }}
                />
              ))}
            </Stack>
          </Box>
        ))}
    </Stack>
  );

  return (
    <>
      {buttons(openAccounts, openSettings)}
      <Drawer
        opened={accountsOpened}
        onClose={closeAccounts}
        title={session?.user && !session.user.isAnonymous ? 'Account' : 'Sign In'}
      >
        <Stack>
          {window.__TAURI__ ? (
            <>
              {isCloning ? (
                <Text size="sm">Waiting for you to sign in...</Text>
              ) : (
                <Text c="dimmed" size="sm">
                  Use the web to manage your account.
                </Text>
              )}
              <Button
                variant="default"
                fullWidth
                onClick={() => {
                  void (async () => {
                    if (session?.user?.isAnonymous) {
                      if (!isCloning) {
                        setCloning(true);
                        useTasks.getState().addTask('signIn', 'Opening browser');
                        const id = await trpc.sessions.startClone.mutate();
                        void openExternal(`${webUrl}/#/app/${id}`);
                        void useTasks.getState().updateTask('signIn', 50, 'Sign in to continue');
                        setCloneInterval(
                          setInterval(() => {
                            void trpc.sessions.finalizeClone.query({ id }).then(async (res) => {
                              if (res) {
                                await useTasks.getState().removeTask('signIn');
                                clearInterval(cloneInterval);
                                window.location.reload();
                              }
                            });
                          }, 1000),
                        );
                      } else {
                        setCloning(false);
                        clearInterval(cloneInterval);
                      }
                    } else {
                      void openExternal(`${webUrl}`);
                    }
                  })();
                }}
              >
                {isCloning ? 'Cancel' : 'Open Browser'}
              </Button>
            </>
          ) : (
            <>
              <Text c="dimmed" size="sm">
                Link an account to save chats and settings.
              </Text>
              {provider('google', 'Google', <Icon icon="lucide:chromium" />)}
              {provider('github', 'GitHub', <Icon icon="lucide:github" />)}
            </>
          )}
          {session?.user && !session.user.isAnonymous && (
            <>
              <Divider />
              <Button
                variant="default"
                fullWidth
                mt={10}
                onClick={() => {
                  void (async () => {
                    useTasks.getState().addTask('signOut', 'Signing out');
                    await auth.signOut();
                    await useTasks.getState().removeTask('signOut');
                    window.location.reload();
                  })();
                }}
              >
                Sign Out
              </Button>
              <Button variant="outline" color="red" fullWidth mt={10} onClick={openDelete}>
                Delete Account
              </Button>
              <Modal opened={isDeleteOpen} onClose={closeDelete} title="Delete Account">
                <Button
                  color="red"
                  fullWidth
                  onClick={() => {
                    void (async () => {
                      await deleteUser();
                      window.location.reload();
                    })();
                  }}
                >
                  Confirm
                </Button>
              </Modal>
            </>
          )}
        </Stack>
      </Drawer>
      <Drawer opened={settingsOpened} onClose={closeSettings} title="Settings">
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
              <Text size="sm">Instructions</Text>
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
              <Text size="sm">Features</Text>
              <Text size="xs" c="dimmed">
                Adding an embedding model enables memory, smart search, and more.
              </Text>
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
              <Text size="sm">Themes</Text>
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
              <Text size="sm">Models</Text>
              {ProviderSettings(chatProviders)}
              <Space />
              <Text size="sm">Search</Text>
              {ProviderSettings(searchProviders)}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Drawer>
    </>
  );
}
