import { useCallback, useState } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import {
  ActionIcon,
  Avatar,
  Burger,
  Divider,
  Group,
  NavLink,
  Space,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { Spotlight, spotlight, SpotlightActionData } from '@mantine/spotlight';
import { useLayout } from '@/stores/layout.tsx';
import { auth, query } from '@/utils/api';
import { scrubText } from '@/utils/text';
import SidebarAccount from '@/core/components/SidebarAccount.tsx';
import { Icon } from '@iconify/react';
import { snippetText, texts } from '@tiny-chat/shared/src/utils.ts';
import SidebarSettings from '@/core/components/SidebarSettings.tsx';
import { version } from '../../../../../apps/tauri/tauri.conf.json';
import SidebarChatList from './SidebarChatList.tsx';
import { useChat } from '@/features/chat/hooks/useChat.ts';
import { useInfiniteQuery } from '@tanstack/react-query';
import { glassStyle } from '@/utils/glass.tsx';
import { useChatStore } from '@/features/chat/stores/useChatStore';
import { ChatService } from '@/features/chat/services/ChatService.ts';
import { useRetrieval } from '@/features/settings/hooks/useRetrieval.ts';

export default function Sidebar() {
  const activeChat = useChat();
  const createTemporary = useChatStore((s) => s.createTemporary);
  const { embeddingConfig, useEmbeddingSearch } = useRetrieval();

  const setCreateTemporary = useChatStore((s) => s.setCreateTemporary);
  const createIncognito = useChatStore((s) => s.createIncognito);
  const setCreateIncognito = useChatStore((s) => s.setCreateIncognito);
  const isTemporary = activeChat.data?.temporary ?? createTemporary;
  const isIncognito = activeChat.data?.incognito ?? createIncognito;

  const isMobile = useLayout((s) => s.isMobile);
  const isSidebarOpen = useLayout((s) => s.isSidebarOpen);
  const setSidebarOpen = useLayout((s) => s.setSidebarOpen);

  const { data: session } = auth.useSession();

  const closeAfter = useCallback(
    (action?: () => void) => {
      action?.();
      if (isMobile) setSidebarOpen(false);
    },
    [isMobile, setSidebarOpen],
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(searchQuery, 400);

  const spotlightActions = useInfiniteQuery({
    ...query.chats.search.infiniteQueryOptions(
      {
        text: debouncedQuery,
        config: useEmbeddingSearch ? embeddingConfig.data : undefined,
        limit: 5,
      },
      {
        enabled: debouncedQuery.trim().length >= 3,
        getNextPageParam: (lastPage, _pages) => lastPage.nextCursor,
        select: (data) => {
          return {
            pages: data.pages.map((page) => ({
              ...page,
              results: page.results.map(
                (result): SpotlightActionData => ({
                  id: result.id,
                  label: result.chatTitle ? scrubText(result.chatTitle, 50) : undefined,
                  description: snippetText(scrubText(texts(result.data)), debouncedQuery),
                  onClick: () => closeAfter(() => ChatService.setChatId(result.chatId)),
                  group: result.folderTitle ?? undefined,
                }),
              ),
            })),
            pageParams: data.pageParams,
          };
        },
      },
    ),
  });

  const expanded = (
    <>
      <Group justify="space-between" px={5} pb={5}>
        <ActionIcon variant="transparent" onClick={spotlight.open}>
          <Icon icon="lucide:search" height={18} color="var(--mantine-color-text)" />
        </ActionIcon>
        <Spotlight
          actions={spotlightActions.data?.pages.flatMap((p) => p.results) ?? []}
          query={searchQuery}
          onQueryChange={setSearchQuery}
          highlightQuery
          scrollAreaProps={{
            mah: 400,
            onBottomReached: () => {
              if (spotlightActions.isFetching) return;
              void spotlightActions.fetchNextPage();
            },
          }}
          nothingFound={
            spotlightActions.isFetching
              ? 'Searching...'
              : searchQuery.trim().length >= 3
                ? 'No results'
                : 'Type to search…'
          }
          filter={(_, actions) => actions}
          styles={{
            content: glassStyle,
          }}
        />
        <Burger opened={isSidebarOpen} onClick={() => setSidebarOpen(!isSidebarOpen)} size={16} />
      </Group>
      <Group align="center" mt={5} gap={2}>
        <NavLink
          label="New Chat"
          leftSection={<Icon icon="lucide:message-circle-plus" height={18} />}
          className="new-chat"
          onClick={() => closeAfter(() => ChatService.setChatId(null))}
          active={!activeChat.data}
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
            onClick={() =>
              closeAfter(() => {
                if (activeChat.data) ChatService.setChatId(null);
                setCreateTemporary(!isTemporary);
              })
            }
            data-active={isTemporary}
          >
            <Icon icon="lucide:eye-off" height={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Anonymous" color="gray" position="right">
          <ActionIcon
            size={32}
            variant="subtle"
            c="dimmed"
            bdrs="md"
            className="nav-link-like filled"
            onClick={() =>
              closeAfter(() => {
                if (activeChat.data) ChatService.setChatId(null);
                setCreateIncognito(!isIncognito);
              })
            }
            data-active={isIncognito}
          >
            <Icon icon="lucide:ghost" height={18} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <Divider my="sm" />
      <SidebarChatList />
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
      <SidebarSettings>
        {(openSettings) => (
          <NavLink
            label={
              <Group justify="space-between">
                Settings
                <Text size="sm" c="dimmed" pr={5}>
                  {version}
                </Text>
              </Group>
            }
            leftSection={<Icon icon="lucide:settings" height={18} />}
            onClick={openSettings}
            bdrs="md"
          />
        )}
      </SidebarSettings>
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
            data-active={!activeChat.data}
            onClick={() => closeAfter(() => ChatService.setChatId(null))}
          >
            <Icon icon="lucide:message-circle-plus" height={18} />
          </ActionIcon>
        </Tooltip>
      </Stack>
      <Stack align="center" gap={5}>
        <SidebarAccount>
          {(openAccount) => (
            <Tooltip
              label={
                !session?.user || session.user.isAnonymous
                  ? 'Sign In'
                  : session.user.name.split(' ')[0]
              }
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
