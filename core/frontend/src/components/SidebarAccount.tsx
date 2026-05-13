import { Button, Divider, Drawer, Group, Modal, Stack, Text, Tooltip } from '@mantine/core';
import { JSX, useEffect, useState } from 'react';
import { useSettings } from '@/stores/settings.tsx';
import { auth, trpc, webUrl } from '@/utils/api';
import { openExternal } from '@/utils/ui';
import { useDisclosure } from '@mantine/hooks';
import { useLayout } from '@/stores/layout.tsx';
import { useTasks } from '@/stores/tasks.tsx';
import { Icon } from '@iconify/react';

export default function SidebarAccount({
  children,
}: {
  children: (open: () => void) => JSX.Element;
}) {
  const [isCloning, setCloning] = useState(false);
  const [cloneInterval, setCloneInterval] = useState<NodeJS.Timeout>();

  const accounts = useSettings((s) => (s.accounts as { providerId: string }[]) ?? []);
  const linkAccount = useSettings((s) => s.linkAccount);
  const unlinkAccount = useSettings((s) => s.unlinkAccount);
  const deleteUser = useSettings((s) => s.deleteUser);

  const setGestureBlock = useLayout((s) => s.setGestureBlock);
  const setDrawerCloser = useLayout((s) => s.setDrawerCloser);
  const { data: session } = auth.useSession();

  const [opened, { open, close }] = useDisclosure(false);
  const [isDeleteOpen, { open: openDelete, close: closeDelete }] = useDisclosure(false);

  useEffect(() => {
    setGestureBlock(isDeleteOpen);
  }, [isDeleteOpen, setGestureBlock]);

  useEffect(() => {
    if (opened) {
      setDrawerCloser(close);
      return () => setDrawerCloser(null);
    }
  }, [opened, close, setDrawerCloser]);

  const provider = (id: string, name: string, icon: JSX.Element) => (
    <Group justify="space-between">
      <Group gap={5}>
        {icon}
        <Text>{name}</Text>
      </Group>
      {accounts.find((account) => account.providerId === id) ? (
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

  return (
    <>
      {children(open)}
      <Drawer
        opened={opened}
        onClose={close}
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
    </>
  );
}
