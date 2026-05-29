import { type RefObject, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Box,
  Group,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
  Transition,
} from '@mantine/core';
import { useMessaging } from '@/stores/messaging.tsx';
import { useLayout } from '@/stores/layout.tsx';
import ChatInputEffects from '@/features/chat/components/ChatInputEffects';
import { ChatInput } from '@/features/chat/components/ChatInput';
import { Icon } from '@iconify/react';
import { useAutoScroll } from '@/core/hooks/useAutoScroll';
import ChatHeader from '@/features/chat/components/ChatHeader';
import Actions from '@/features/chat/components/Actions';
import Message from '@/features/message/components/Message';
import { refetchActiveChat, useChat } from '@/features/chat/hooks/useChat';
import { useMessages } from '@/features/message/hooks/useMessages';
import { useGreeting } from '@/core/hooks/useGreeting';
import { useSentinel } from '@/core/hooks/useSentinel';
import { useMergedRef } from '@mantine/hooks';
import { useChatStore } from '@/features/chat/stores/useChatStore';
import { query } from '@/utils/api';
import { useIsMutating } from '@tanstack/react-query';
import { deleteMessageMutationKey, sendMessageMutationKey } from '../hooks/useSend';
import { uploadMutationKey } from '@/features/input/hooks/useUploads';
import { isMissingToolResult } from '@/utils/ui';

function useElementHeight(initialHeight = 0): {
  ref: RefObject<HTMLDivElement | null>;
  height: number;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(initialHeight);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      setHeight(el.clientHeight);
    });

    observer.observe(el);
    setHeight(el.clientHeight);
    return () => observer.disconnect();
  }, []);

  return { ref, height };
}

export default function Chat() {
  const activeChat = useChat();
  const messages = useMessages();

  const createTemporary = useChatStore((s) => s.createTemporary);
  const createIncognito = useChatStore((s) => s.createIncognito);

  const isMobile = useLayout((s) => s.isMobile);
  const shadow = useLayout((s) => s.shadow);
  const isInitializing = useLayout((s) => s.isInitializing);

  const scrollRequested = useMessaging((s) => (activeChat.isFetching ? 0 : s.scrollRequested));
  const scrollInstant = useMessaging((s) => (activeChat.isFetching ? 0 : s.scrollInstant));

  const {
    viewportRef: viewportRef1,
    viewportNodeRef,
    isAtBottom,
    scrollToBottom,
  } = useAutoScroll({
    scrollRequested,
    isInitializing,
  });

  const [oldHeight, setOldHeight] = useState(-1);
  const { viewportRef: viewportRef2, sentinelRef } = useSentinel({
    query: messages,
    queryKey: query.messages.listInfinite.pathKey(),
    onFetchNextPage: useCallback(() => {
      if (viewportNodeRef.current) {
        setOldHeight(viewportNodeRef.current.scrollHeight);
      }
    }, [viewportNodeRef]),
  });
  useLayoutEffect(() => {
    if (viewportNodeRef.current && oldHeight >= 0 && !messages.isFetchingNextPage) {
      const newHeight = viewportNodeRef.current.scrollHeight;
      console.log('scrolling to', newHeight - oldHeight);
      viewportNodeRef.current.scrollTo({
        top: newHeight - oldHeight,
        behavior: 'instant',
      });
      setOldHeight(-1);
    }
  }, [viewportNodeRef, oldHeight, messages.isFetchingNextPage, scrollToBottom]);

  const viewportRef = useMergedRef(viewportRef1, viewportRef2);

  useLayoutEffect(() => {
    if (scrollInstant > 0) {
      scrollToBottom('instant');
    }
  }, [scrollInstant, scrollToBottom]);

  const editing = useMessaging((s) => s.editing);
  const insertingAfter = useMessaging((s) => s.insertingAfter);
  const truncating = useMessaging((s) => s.truncating);

  const messageOpacities = useMemo(() => {
    const map = new Map<string, number>();
    let hasHitEdit = false;
    for (const message of messages.data?.pages.flatMap((page) => page.messages) ?? []) {
      if (!editing && !insertingAfter) {
        map.set(message.id, 1);
      } else if (message.id === editing?.id) {
        hasHitEdit = true;
        map.set(message.id, 1);
      } else if (!hasHitEdit || (message.previousId !== editing?.id && !truncating)) {
        map.set(message.id, 0.5);
      } else {
        map.set(message.id, 0.1);
      }
    }
    return map;
  }, [messages, editing, insertingAfter, truncating]);

  const inputMaxWidth = 860;
  const inputRef = useRef<HTMLDivElement>(null);

  const { ref: inputEffectsRef, height: inputEffectsHeight } = useElementHeight();
  const { ref: chatContainerRef, height: chatContainerHeight } = useElementHeight(600);

  const greeting = useGreeting();
  const isNewChat = !activeChat.data;

  const isSendingMessage = useIsMutating({ mutationKey: sendMessageMutationKey }) > 0;
  const isDeletingMessage = useIsMutating({ mutationKey: deleteMessageMutationKey }) > 0;
  const isUploading = useIsMutating({ mutationKey: uploadMutationKey }) > 0;
  const isAny = useMemo(
    () =>
      isSendingMessage ||
      isDeletingMessage ||
      isUploading ||
      messages.isFetching ||
      ((messages.data?.pages.flatMap((p) => p.messages).some((m) => isMissingToolResult(m)) ??
        false) &&
        !editing),
    [isSendingMessage, isDeletingMessage, isUploading, messages.isFetching, editing, messages.data],
  );

  return (
    <Stack h="100%" gap={0}>
      <ChatHeader fixed={true} />
      {/* Main content area */}
      <Box flex={1} pos="relative" mih={0} style={{ overflow: 'hidden' }} ref={chatContainerRef}>
        {/* New chat hero overlay */}
        <Stack
          pos="absolute"
          inset={0}
          justify="center"
          align="center"
          gap={0}
          opacity={isNewChat ? 1 : 0}
          style={{
            transition: 'opacity 400ms ease',
            pointerEvents: isNewChat ? 'auto' : 'none',
          }}
        >
          {/* Icon + title: cross-fade between incognito×temporary combinations */}
          <div style={{ display: 'grid', placeItems: 'center' }}>
            {/* Normal – New Chat */}
            <Stack
              align="center"
              gap={6}
              style={{
                gridArea: '1 / 1',
                opacity: !createIncognito && !createTemporary ? 1 : 0,
                transition: 'opacity 300ms ease',
                willChange: 'opacity',
                pointerEvents: !createIncognito && !createTemporary ? 'auto' : 'none',
              }}
            >
              <Text size="xl" fw={600} mt={4}>
                {greeting}
              </Text>
            </Stack>
            {/* Normal – Temporary Chat */}
            <Stack
              align="center"
              gap={6}
              style={{
                gridArea: '1 / 1',
                opacity: !createIncognito && createTemporary ? 1 : 0,
                transition: 'opacity 300ms ease',
                willChange: 'opacity',
                pointerEvents: !createIncognito && createTemporary ? 'auto' : 'none',
              }}
            >
              <Text size="xl" fw={600} mt={4}>
                {greeting}
              </Text>
            </Stack>
            {/* Incognito – New Chat */}
            <Stack
              align="center"
              gap={6}
              style={{
                gridArea: '1 / 1',
                opacity: createIncognito && !createTemporary ? 1 : 0,
                transition: 'opacity 300ms ease',
                willChange: 'opacity',
                pointerEvents: createIncognito && !createTemporary ? 'auto' : 'none',
              }}
            >
              <Text size="xl" fw={600} mt={4}>
                {greeting}
              </Text>
            </Stack>
            {/* Incognito – Temporary Chat */}
            <Stack
              align="center"
              gap={6}
              style={{
                gridArea: '1 / 1',
                opacity: createIncognito && createTemporary ? 1 : 0,
                transition: 'opacity 300ms ease',
                willChange: 'opacity',
                pointerEvents: createIncognito && createTemporary ? 'auto' : 'none',
              }}
            >
              <Text size="xl" fw={600} mt={4}>
                {greeting}
              </Text>
            </Stack>
          </div>
          {/* Subtitle: cross-fade between incognito states */}
          <Text
            size="sm"
            c="dimmed"
            style={{
              opacity: createTemporary ? 1 : 0,
              transition: 'opacity 300ms ease',
              willChange: 'opacity',
              pointerEvents: createTemporary ? 'auto' : 'none',
            }}
          >
            {createTemporary && 'Chat will not be saved'}
            &nbsp;
          </Text>
        </Stack>

        {/* Messages scroll area */}
        <ScrollArea
          h="100%"
          pos="relative"
          styles={{
            scrollbar: {
              zIndex: 'calc(var(--mantine-z-index-app) + 1)',
            },
          }}
          viewportRef={viewportRef}
          style={{ opacity: isNewChat ? 0 : 1, transition: 'opacity 400ms ease' }}
          flex={1}
          inset={0}
        >
          <Stack pt={isMobile ? 40 : 10} px={20} m="0 auto" maw={860} gap={10}>
            <>
              <Skeleton
                height={10}
                width="100%"
                opacity={messages.isFetching ? 1 : 0.25}
                animate={messages.isFetching}
                ref={sentinelRef}
              />
              {messages.data?.pages
                .flatMap((page) => page.messages)
                .map((message) => (
                  <Message
                    key={message.id}
                    message={message}
                    opacity={messageOpacities.get(message.id) ?? 1}
                    isLast={
                      message.id ===
                      messages.data?.pages.flatMap((page) => page.messages).at(-1)?.id
                    }
                  />
                ))}
              <Box mb={20}>
                <Actions />
              </Box>
            </>
          </Stack>
        </ScrollArea>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            maskImage: `linear-gradient(transparent calc(100% - ${40 + inputEffectsHeight}px), black 100%)`, // TODO - tasks - 100px
            //maskImage: `linear-gradient(black ${isMobile ? 55 : 0}px, transparent ${isMobile ? 95 : 40}px, transparent calc(100% - ${40 + inputEffectsHeight}px), black 100%)`, // TODO - tasks - 100px
            background: 'var(--mantine-color-body)',
          }}
        />

        <Group
          gap={5}
          style={{
            position: 'absolute',
            bottom: inputEffectsHeight + 16,
            right: 20,
            zIndex: 'calc(var(--mantine-z-index-app) + 1)',
          }}
        >
          <Transition
            mounted={!isNewChat && !!activeChat.data?.unseen}
            transition="pop"
            duration={200}
            timingFunction="ease"
          >
            {(styles) => (
              <ActionIcon
                variant="filled"
                radius="xl"
                size="lg"
                style={{
                  boxShadow: shadow,
                  ...styles,
                }}
                onClick={() => {
                  void refetchActiveChat(activeChat.data!.id);
                }}
              >
                <Icon icon="lucide:refresh-cw" height={18} />
              </ActionIcon>
            )}
          </Transition>
          <Transition
            mounted={!isAtBottom && !isNewChat}
            transition="slide-up"
            duration={200}
            timingFunction="ease"
          >
            {(styles) => (
              <ActionIcon
                variant="filled"
                radius="xl"
                size="lg"
                style={{
                  boxShadow: shadow,
                  ...styles,
                }}
                onClick={() => {
                  scrollToBottom('smooth');
                }}
              >
                <Icon icon="lucide:chevrons-down" height={18} />
              </ActionIcon>
            )}
          </Transition>
        </Group>

        <ChatInputEffects
          inputEffectsRef={inputEffectsRef}
          chatContainerHeight={chatContainerHeight}
          inputMaxWidth={inputMaxWidth}
          isAny={isAny}
        />
      </Box>

      {/* Input area */}
      <Box style={{ background: 'var(--mantine-color-body)' }}>
        <Box
          w="100%"
          maw={inputMaxWidth}
          m="0 auto"
          p={isMobile ? '0 10px 10px 10px' : '0 20px 20px 20px'}
          ref={inputRef}
        >
          <ChatInput style={{ borderRadius: 25 }} isAny={isAny} />
        </Box>
      </Box>
    </Stack>
  );
}
