import { useCallback, useEffect, useState } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import {
  ActionIcon,
  Avatar,
  Burger,
  Divider,
  Group,
  NavLink,
  ScrollArea,
  Space,
  Stack,
  Tooltip,
} from '@mantine/core';
import { Spotlight, spotlight, SpotlightActionData } from '@mantine/spotlight';
import { useLayout } from '@/stores/layout.tsx';
import SidebarChat from '@/components/SidebarChat.tsx';
import { useChats } from '@/stores/chats.tsx';
import { useLocation } from 'wouter';
import { auth, trpc } from '@/utils/api';
import { extractText, scrubText } from '@/utils/text';
import SidebarAccount from '@/components/SidebarAccount';
import { useSettings } from '@/stores/settings.tsx';
import { Icon } from '@iconify/react';
import { snippetText } from '@tiny-chat/core-backend/src/types.ts';
import SidebarSettings from '@/components/SidebarSettings.tsx';

export default function Sidebar() {
  const folders = useChats((s) => s.folders);
  const currentChat = useChats((s) => s.currentChat);
  const setCurrentChat = useChats((s) => s.setCurrentChat);
  const temporary = useChats((s) => s.temporary);
  const setTemporary = useChats((s) => s.setTemporary);
  const incognito = useChats((s) => s.incognito);
  const setIncognito = useChats((s) => s.setIncognito);

  const isMobile = useLayout((s) => s.isMobile);
  const isSidebarOpen = useLayout((s) => s.isSidebarOpen);
  const setSidebarOpen = useLayout((s) => s.setSidebarOpen);

  const embeddingConfig = useSettings((s) => s.settings.embeddingConfig);
  const useEmbeddingSearch = useSettings((s) => s.settings.useEmbeddingSearch ?? true);

  const { data: session, isPending: isSessionPending } = auth.useSession();

  const [location] = useLocation();
  useEffect(() => {
    if (isSessionPending || !session?.user) return;
    if (window.location.hash.length < 2) window.location.hash = '#/';
    if (!window.location.hash.startsWith('#/app/')) {
      if ((currentChat?.id ?? '') !== location.slice(1)) {
        void setCurrentChat(location.slice(1) || null, false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, isSessionPending, session?.user.id, session?.user]);

  const closeAfter = useCallback(
    (action?: () => void) => {
      action?.();
      if (isMobile) setSidebarOpen(false);
    },
    [isMobile, setSidebarOpen],
  );

  const isTemporary = temporary || currentChat?.temporary;
  const isIncognito = incognito || currentChat?.incognito;

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(searchQuery, 400);
  const [spotlightActions, setSpotlightActions] = useState<SpotlightActionData[]>([]); // TODO - SpotlightActionGroup

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!(debouncedQuery.trim()?.length >= 3)) {
        setSpotlightActions([]);
        return;
      }

      if (cancelled) return;

      const results = await trpc.chats.search.mutate({
        text: debouncedQuery,
        config: useEmbeddingSearch ? embeddingConfig : undefined,
      });
      if (cancelled) return;
      console.log('Results for', debouncedQuery, results);
      const seen = new Set<string>();
      setSpotlightActions(
        results
          .filter((r) => {
            if (seen.has(r.chatId)) return false;
            seen.add(r.chatId);
            return true;
          })
          .map((r) => ({
            id: r.id,
            label: scrubText(r.chatTitle ?? '', 50),
            description: snippetText(scrubText(extractText(r.data)), debouncedQuery),
            onClick: () => closeAfter(() => void setCurrentChat(r.chatId)), // TODO - scroll to chat
          })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [closeAfter, debouncedQuery, embeddingConfig, setCurrentChat, useEmbeddingSearch]);

  const expanded = (
    <>
      <Group justify="space-between" px={5} pb={5}>
        <ActionIcon variant="transparent" onClick={spotlight.open}>
          <Icon icon="lucide:search" height={18} color="var(--mantine-color-text)" />
        </ActionIcon>
        <Spotlight
          actions={spotlightActions}
          query={searchQuery}
          onQueryChange={setSearchQuery}
          highlightQuery
          scrollAreaProps={{ mah: 400 }}
          nothingFound={searchQuery.trim().length >= 3 ? 'No results' : 'Type to search…'}
          filter={(_, actions) => actions}
        />
        <Burger opened={isSidebarOpen} onClick={() => setSidebarOpen(!isSidebarOpen)} size={16} />
      </Group>
      <Group align="center" mt={5} gap={2}>
        <NavLink
          label="New Chat"
          leftSection={<Icon icon="lucide:message-circle-plus" height={18} />}
          className="new-chat"
          onClick={() => closeAfter(() => void setCurrentChat(null))}
          active={!currentChat}
          variant="subtle"
          flex={1}
          bdrs="md"
        />
        <Tooltip label="Temporary" color="gray" position="right">
          <ActionIcon
            size={32}
            variant="subtle"
            c="dimmed"
            bdrs="md"
            className="nav-link-like filled"
            onClick={() => closeAfter(() => void setTemporary(!isTemporary))}
            data-active={isTemporary}
          >
            <Icon icon="lucide:list-x" height={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Anonymous" color="gray" position="right">
          <ActionIcon
            size={32}
            variant="subtle"
            c="dimmed"
            bdrs="md"
            className="nav-link-like filled"
            onClick={() => closeAfter(() => void setIncognito(!isIncognito))}
            data-active={isIncognito}
          >
            <Icon icon="lucide:user-x" height={18} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <Divider my="sm" />
      <ScrollArea flex={1}>
        <Stack gap={5}>
          {folders.map((folder) =>
            folder.chats.length === 1 ? (
              <SidebarChat
                key={folder.chats[0].id}
                chat={folder.chats[0]}
                props={{
                  onClick: () => closeAfter(() => void setCurrentChat(folder.chats[0].id)),
                  bdrs: 'md',
                }}
              />
            ) : (
              <NavLink
                key={folder.id}
                label={folder.title ?? 'Sending...'}
                leftSection={folder.chats.length}
                defaultOpened={true}
              >
                {folder.chats.map((chat) => (
                  <SidebarChat
                    key={chat.id}
                    chat={chat}
                    props={{
                      onClick: () => closeAfter(() => void setCurrentChat(chat.id)),
                      bdrs: 'md',
                    }}
                  />
                ))}
              </NavLink>
            ),
          )}
        </Stack>
      </ScrollArea>
      <Divider my="sm" />
      <SidebarAccount>
        {(openAccount) => (
          <NavLink
            label={
              !session?.user || session.user.isAnonymous
                ? 'Sign In'
                : session.user.name.split(' ')[0]
            }
            leftSection={
              session?.user?.image ? (
                <Avatar src={session.user.image} size={18} />
              ) : (
                <Icon icon="lucide:circle-user" height={18} />
              )
            }
            onClick={openAccount}
            bdrs="md"
          />
        )}
      </SidebarAccount>
      {/*<SidebarSettings>
        {(openSettings) => (
          <NavLink
            label={
              <Group justify="space-between">
                Settings
                <Text size="sm" c="dimmed" pr={5}>
                  v{version}
                </Text>
              </Group>
            }
            leftSection={<Icon icon="lucide:settings" height={18} />}
            onClick={openSettings}
            bdrs="md"
          />
        )}
      </SidebarSettings>*/}
    </>
  );

  const collapsed = (
    <Stack align="center" justify="space-between" h="100%" gap={0} py={4}>
      <Stack align="center" gap={5}>
        <Burger opened={isSidebarOpen} onClick={() => setSidebarOpen(!isSidebarOpen)} size={16} />
        <Space />
        <Tooltip label="New Chat" position="right" color="gray">
          <ActionIcon
            variant="subtle"
            size={32}
            c="dimmed"
            className="new-chat nav-link-like filled"
            data-active={!currentChat}
            onClick={() => closeAfter(() => void setCurrentChat(null))}
          >
            <Icon icon="lucide:message-circle-plus" height={18} />
          </ActionIcon>
        </Tooltip>
      </Stack>
      <Stack align="center" gap={5}>
        <SidebarAccount>
          {(openAccount) => (
            <Tooltip
              label={!session?.user || session.user.isAnonymous ? 'Sign In' : 'Account'}
              position="right"
              color="gray"
            >
              <ActionIcon
                variant="subtle"
                size={32}
                c="dimmed"
                className="nav-link-like"
                onClick={openAccount}
              >
                {session?.user?.image ? (
                  <Avatar src={session.user.image} size={18} />
                ) : (
                  <Icon icon="lucide:user-x" height={18} />
                )}
              </ActionIcon>
            </Tooltip>
          )}
        </SidebarAccount>
        <SidebarSettings>
          {(openSettings) => (
            <Tooltip label="Settings" position="right" color="gray">
              <ActionIcon
                variant="subtle"
                size={32}
                c="dimmed"
                className="nav-link-like"
                onClick={openSettings}
              >
                <Icon icon="lucide:settings" height={18} />
              </ActionIcon>
            </Tooltip>
          )}
        </SidebarSettings>
      </Stack>
    </Stack>
  );

  if (isMobile) {
    return expanded;
  }

  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: isSidebarOpen ? 1 : 0,
          visibility: isSidebarOpen ? 'visible' : 'hidden',
          transition:
            'opacity 200ms ease 50ms, visibility 0ms linear ' + (isSidebarOpen ? '0ms' : '250ms'),
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {expanded}
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: isSidebarOpen ? 0 : 1,
          visibility: isSidebarOpen ? 'hidden' : 'visible',
          transition:
            'opacity 200ms ease 50ms, visibility 0ms linear ' + (isSidebarOpen ? '250ms' : '0ms'),
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {collapsed}
      </div>
    </div>
  );
}
