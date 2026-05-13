import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Box,
  Group,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  Transition,
} from '@mantine/core';
import { useMessaging } from '@/stores/messaging.tsx';
import { useLayout } from '@/stores/layout.tsx';
import ChatInputEffects from '@/components/ChatInputEffects.tsx';
import { useChats } from '@/stores/chats.tsx';
import { ChatInput } from '@/components/ChatInput.tsx';
import { auth } from '@/utils/api';
import { Icon } from '@iconify/react';
import { useAutoScroll } from '@/hooks/useAutoScroll.ts';
import { useElementHeight } from '@/hooks/useElementHeight.ts';
import ChatHeader from '@/components/ChatHeader.tsx';
import { ChatMessages } from '@/components/ChatMessages.tsx';

export default function Chat() {
  const currentChat = useChats((s) => s.currentChat);
  const setCurrentChat = useChats((s) => s.setCurrentChat);
  const updatedChats = useChats((s) => s.updatedChats);
  const temporary = useChats((s) => s.temporary);
  const incognito = useChats((s) => s.incognito);

  const scrollRequested = useMessaging((s) => s.scrollRequested);
  const scrollMessageId = useMessaging((s) => s.scrollMessageId);
  const scrollMessageRequested = useMessaging((s) => s.scrollMessageRequested);

  const isMobile = useLayout((s) => s.isMobile);
  const shadow = useLayout((s) => s.shadow);
  const isInitializing = useLayout((s) => s.isInitializing);
  const isMessaging = useLayout((s) => s.isMessaging);
  const getSidebarWidth = useLayout((s) => s.getSidebarWidth);
  const isiPhone = navigator.userAgent.includes('iPhone');

  const { data: session } = auth.useSession();

  const {
    viewportRef: messagesViewportRef,
    isAtBottom,
    scrollToBottom,
  } = useAutoScroll({
    scrollRequested,
    isInitializing,
  });

  // Keep a stable ref to the viewport DOM node for imperative scroll-to-message
  const viewportNodeRef = useRef<HTMLDivElement | null>(null);
  const stableViewportRef = useCallback(
    (node: HTMLDivElement | null) => {
      viewportNodeRef.current = node;
      messagesViewportRef(node);
    },
    [messagesViewportRef],
  );

  const inputMaxWidth = 860;
  const inputRef = useRef<HTMLDivElement>(null);
  const [isInputMaxWidth, setIsInputMaxWidth] = useState(
    window.innerWidth > 860 + getSidebarWidth(),
  );

  useLayoutEffect(() => {
    const handleResize = () => {
      setIsInputMaxWidth(
        (inputRef.current?.clientWidth ?? window.innerWidth - getSidebarWidth()) >= inputMaxWidth,
      );
    };
    const observer = new ResizeObserver(() => handleResize());
    if (inputRef.current) observer.observe(inputRef.current);
    handleResize();
    return () => observer.disconnect();
  }, [getSidebarWidth]);

  const { ref: inputEffectsRef, height: inputEffectsHeight } = useElementHeight();
  const { ref: chatContainerRef, height: chatContainerHeight } = useElementHeight(600);

  const [hasBeenNewChat, setHasBeenNewChat] = useState(false);

  const isNewChat = !currentChat && !isInitializing;

  useEffect(() => {
    if (isNewChat) {
      setTimeout(() => setHasBeenNewChat(true)); // TODO - even more yughhhhhhhhhhhh (see eslint when removing the timeout)
    }
  }, [isNewChat]);

  // Scroll a specific message into view when requested
  useEffect(() => {
    if (!scrollMessageId) return;
    const viewport = viewportNodeRef.current;
    if (!viewport) return;
    const el = viewport.querySelector(`[data-message-id="${scrollMessageId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollMessageRequested]);

  return (
    <Stack h="100%" gap={0} px={!isInputMaxWidth && !currentChat ? 20 : 0}>
      {isMobile && <ChatHeader fixed={true} />}
      {/* Main content area */}
      <Box flex={1} pos="relative" mih={0} style={{ overflow: 'hidden' }} ref={chatContainerRef}>
        {/* New chat hero overlay */}
        <Stack
          pos="absolute"
          inset={0}
          justify="flex-end"
          align="center"
          pb={24}
          gap={0}
          opacity={isNewChat ? 1 : 0}
          style={{
            transition: 'opacity 300ms ease',
            pointerEvents: isNewChat ? 'auto' : 'none',
          }}
        >
          <div style={{ display: 'grid', placeItems: 'center' }}>
            <Stack
              align="center"
              gap={6}
              style={{
                gridArea: '1 / 1',
                opacity: !temporary ? 1 : 0,
                transition: 'opacity 300ms ease',
                willChange: 'opacity',
                pointerEvents: !temporary ? 'auto' : 'none',
              }}
            >
              <ThemeIcon variant="light" size={48} radius="xl">
                <Icon icon="lucide:list-plus" height={26} />
              </ThemeIcon>
              <Text size="xl" fw={600} mt={4}>
                New Chat
              </Text>
            </Stack>
            <Stack
              align="center"
              gap={6}
              style={{
                gridArea: '1 / 1',
                opacity: temporary ? 1 : 0,
                transition: 'opacity 300ms ease',
                willChange: 'opacity',
                pointerEvents: temporary ? 'auto' : 'none',
              }}
            >
              <ThemeIcon variant="light" color="gray" size={48} radius="xl">
                <Icon icon="lucide:list-x" height={26} />
              </ThemeIcon>
              <Text size="xl" fw={600} mt={4}>
                New Temporary Chat
              </Text>
            </Stack>
          </div>
          {!incognito ? (
            <Text size="sm" c="dimmed" mt={6}>
              What's on the agenda
              {!session?.user?.isAnonymous &&
                session?.user?.name &&
                `, ${session.user.name.split(' ')[0]}`}
              ?
            </Text>
          ) : (
            <Text size="sm" c="dimmed" mt={6}>
              No memories will be available in this chat
            </Text>
          )}
        </Stack>

        {/* Messages scroll area */}
        {!isNewChat && (
          <>
            <ScrollArea
              viewportRef={stableViewportRef}
              h="100%"
              styles={{
                scrollbar: {
                  zIndex: 'calc(var(--mantine-z-index-app) + 1)',
                },
              }}
            >
              <ChatHeader fixed={false} />
              <ChatMessages />
            </ScrollArea>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                maskImage: `linear-gradient(black 0%, transparent 25px, transparent calc(100% - ${25 + inputEffectsHeight}px), black 100%)`, // TODO - tasks - 100px
                background: 'var(--mantine-color-body)',
              }}
            />
          </>
        )}

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
            mounted={!isNewChat && !!currentChat && updatedChats.includes(currentChat.id)}
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
                  void setCurrentChat(currentChat!.id, false, true);
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
          isInputMaxWidth={isInputMaxWidth}
        />
      </Box>

      {/* Input area */}
      <Box
        w="100%"
        maw={inputMaxWidth}
        m={`0 auto ${!isNewChat && isInputMaxWidth ? 20 : 0} auto`}
        p={isInputMaxWidth ? 0 : '0 10px 10px 10px'}
        ref={inputRef}
      >
        <ChatInput style={{ boxShadow: shadow, borderRadius: 10 }} />
      </Box>

      {/* Bottom spacer for vertical centering in new chat mode */}
      <div
        style={{
          flexGrow: isNewChat && !(isiPhone && isMessaging) ? 1 : 0,
          flexShrink: 0,
          flexBasis: isNewChat && !(isiPhone && isMessaging) ? 60 : 0,
          transition: hasBeenNewChat ? 'flex-grow 400ms ease, flex-basis 400ms ease' : 'none',
        }}
      />
    </Stack>
  );
}
