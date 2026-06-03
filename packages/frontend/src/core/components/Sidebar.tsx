import { useCallback, useState } from 'react';
import { useDebouncedValue /*, useHotkeys*/ } from '@mantine/hooks';
import { ActionIcon, Avatar, Burger, Group, NavLink, Stack, Text, Tooltip } from '@mantine/core';
import { Spotlight, spotlight, SpotlightActionData } from '@mantine/spotlight';
import { useLayoutStore } from '@/core/stores/useLayoutStore.tsx';
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
//import WebLLM from '@/core/components/WebLLM.tsx';

export default function Sidebar() {
  const { chat } = useChat();
  const createTemporary = useChatStore((s) => s.createTemporary);
  const { embeddingConfig, useEmbeddingSearch } = useRetrieval();

  const setCreateTemporary = useChatStore((s) => s.setCreateTemporary);
  const createIncognito = useChatStore((s) => s.createIncognito);
  const setCreateIncognito = useChatStore((s) => s.setCreateIncognito);
  const isTemporary = chat.data?.temporary ?? createTemporary;
  const isIncognito = chat.data?.incognito ?? createIncognito;

  const isMobile = useLayoutStore((s) => s.isMobile);
  const isSidebarOpen = useLayoutStore((s) => s.isSidebarOpen);
  const setSidebarOpen = useLayoutStore((s) => s.setSidebarOpen);

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

  //const [superSecretWebLLMMenuOpened, setSuperSecretWebLLMMenuOpened] = useState(false);
  //useHotkeys([['mod+h', () => setSuperSecretWebLLMMenuOpened(true)]]);

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
      <Group justify="space-between" p="xs">
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
      <Group align="center" my="md" gap={3}>
        <NavLink
          label="New Chat"
          variant="filled"
          c="dimmed"
          className="nav-link-like filled"
          leftSection={<Icon icon="lucide:message-circle-plus" height={18} />}
          onClick={() => closeAfter(() => ChatService.setChatId(null))}
          active={!chat.data}
          flex={1}
          h={40}
        />
        <Tooltip label="Temporary" color="gray" position="right">
          <ActionIcon
            size={40}
            variant="subtle"
            c={!isTemporary ? 'dimmed' : undefined}
            className="nav-link-like"
            onClick={() =>
              closeAfter(() => {
                if (chat.data) ChatService.setChatId(null);
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
            size={40}
            variant="subtle"
            c={!isIncognito ? 'dimmed' : undefined}
            className="nav-link-like"
            onClick={() =>
              closeAfter(() => {
                if (chat.data) ChatService.setChatId(null);
                setCreateIncognito(!isIncognito);
              })
            }
            data-active={isIncognito}
          >
            <Icon icon="lucide:ghost" height={18} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <SidebarChatList />
      <SidebarAccount>
        {(openAccount) => (
          <NavLink
            mt="lg"
            c="dimmed"
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
            h={40}
            mb={5}
          />
        )}
      </SidebarAccount>
      <SidebarSettings>
        {(openSettings) => (
          <NavLink
            c="dimmed"
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
            h={40}
            mb={5}
          />
        )}
      </SidebarSettings>
    </>
  );

  const collapsed = (
    <Stack align="center" justify="space-between" h="100%" py="xs">
      <Stack align="center" gap="lg">
        <Burger opened={isSidebarOpen} onClick={() => setSidebarOpen(!isSidebarOpen)} size={16} />
        <Tooltip label="New Chat" position="right" color="gray">
          <ActionIcon
            variant="subtle"
            size={32}
            c="dimmed"
            className="nav-link-like filled"
            data-active={!chat.data}
            onClick={() => closeAfter(() => ChatService.setChatId(null))}
          >
            <Icon icon="lucide:message-circle-plus" height={18} />
          </ActionIcon>
        </Tooltip>
      </Stack>
      <Stack align="center" gap="sm">
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
      {/*<WebLLM
        opened={superSecretWebLLMMenuOpened}
        onClose={() => setSuperSecretWebLLMMenuOpened(false)}
      />*/}
    </div>
  );
}
