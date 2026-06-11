import { Button, Divider, Drawer, Group, Modal, Stack, Text, Tooltip } from '@mantine/core';
import { JSX, useEffect, useState } from 'react';
import { auth, isTauri, trpc, webUrl } from '@/utils/api';
import { openExternal } from '@/utils/ui';
import { useDisclosure } from '@mantine/hooks';
import { useLayoutStore } from '@/core/stores/useLayoutStore';
import { Icon } from '@iconify/react';
import { glassStyle } from '@/utils/glass';
import { useAccounts } from '@/features/settings/hooks/useAccounts';

export default function SidebarAccount({
  children,
}: {
  children: (open: () => void) => JSX.Element;
}) {
  const [isCloning, setCloning] = useState(false);
  const [cloneInterval, setCloneInterval] = useState<NodeJS.Timeout>();

  const { accounts, linkAccount, unlinkAccount, deleteUser } = useAccounts();

  const setGestureBlock = useLayoutStore((s) => s.setGestureBlock);
  const setDrawerCloser = useLayoutStore((s) => s.setDrawerCloser);
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
      {accounts.data?.find((account) => account.providerId === id) ? (
        accounts.data?.length === 1 ? (
          <Tooltip label="Must have one account" color="gray">
            <Button variant="light" onClick={() => unlinkAccount.mutate(id)} disabled>
              Unlink
            </Button>
          </Tooltip>
        ) : (
          <Button variant="light" onClick={() => unlinkAccount.mutate(id)}>
            Unlink
          </Button>
        )
      ) : (
        <Button variant="default" onClick={() => linkAccount.mutate(id)}>
          Link
        </Button>
      )}
    </Group>
  );

  const clone = async (open: boolean) => {
    if (!isCloning) {
      setCloning(true);
      const id = await trpc.user.startClone.mutate(); // TODO - use query
      if (open) void openExternal(`${webUrl}/#?clone=${id}`);
      else void navigator.clipboard.writeText(`${webUrl}/#?clone=${id}`);
      setCloneInterval(
        setInterval(() => {
          void trpc.user.finalizeClone.query({ id }).then((res) => {
            if (res) {
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
  };

  return (
    <>
      {children(open)}
      <Drawer
        opened={opened}
        onClose={close}
        title={session?.user && !session.user.isAnonymous ? 'Account' : 'Sign In'}
      >
        <Stack>
          {isTauri() ? (
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
                  if (session?.user?.isAnonymous) {
                    if (isCloning) {
                      clearInterval(cloneInterval);
                      setCloning(false);
                    }
                    void clone(true);
                  } else {
                    void openExternal(`${webUrl}`);
                  }
                }}
              >
                {isCloning ? 'Cancel' : 'Open Browser'}
              </Button>
              <Text size="xs" c="dimmed">
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();

                    if (session?.user?.isAnonymous) {
                      if (isCloning) {
                        clearInterval(cloneInterval);
                        setCloning(false);
                      }
                      void clone(false);
                    } else {
                      void openExternal(`${webUrl}`);
                    }
                  }}
                >
                  or copy the link
                </a>
              </Text>
            </>
          ) : (
            <>
              <Text c="dimmed" size="sm">
                Link an account to save chats and settings.
              </Text>
              {provider('google', 'Google', <Icon icon="lucide:chromium" />)}
              {provider('github', 'GitHub', <Icon icon="lucide:github" />)}
              {provider('huggingface', 'Hugging Face', <Icon icon="lucide:smile" />)}
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
                    await auth.signOut();
                    window.location.reload();
                  })();
                }}
              >
                Sign Out
              </Button>
              <Button variant="outline" color="red" fullWidth mt={10} onClick={openDelete}>
                Delete Account
              </Button>
              <Modal
                opened={isDeleteOpen}
                onClose={closeDelete}
                title="Delete Account"
                styles={{ content: glassStyle }}
                centered
              >
                <Button
                  color="red"
                  fullWidth
                  onClick={() => {
                    deleteUser.mutate();
                  }}
                  loading={deleteUser.isPending}
                  disabled={deleteUser.isPending}
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
