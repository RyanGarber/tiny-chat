import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Box,
  Burger,
  Group,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
  Transition,
} from '@mantine/core';
import Message from '@/components/Message.tsx';
import { useMessaging } from '@/managers/messaging.tsx';
import { useLayout } from '@/managers/layout.tsx';
import InputEffect from '@/components/InputEffect.tsx';
import { useChats } from '@/managers/chats.tsx';
import { Input } from '@/components/Input.tsx';
import { auth, extractText, scrubText } from '@/utils.ts';
import Attachments from '@/components/Attachments.tsx';
import { Icon } from '@iconify/react';
import Actions from '@/components/Actions.tsx';

const SCROLL_BOTTOM_THRESHOLD = 80;

export default function Chat() {
  const {
    currentChat,
    setCurrentChat,
    messages,
    temporary,
    setTemporary,
    incognito,
    setIncognito,
  } = useChats();

  const {
    files,
    removeFile,
    editing,
    setEditing,
    truncating,
    setTruncating,
    insertingAfter,
    setInsertingAfter,
    scrollRequested,
  } = useMessaging();

  const {
    isMobile,
    shadow,
    isInitializing,
    isMessaging,
    getSidebarWidth,
    isSidebarOpen,
    setSidebarOpen,
  } = useLayout();
  const isiPhone = navigator.userAgent.includes('iPhone');

  const { data: session } = auth.useSession();

  const messagesViewportRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const smoothScrollVersionRef = useRef(0);
  const isSmoothScrollingRef = useRef(false);

  const [hasBeenNewChat, setHasBeenNewChat] = useState(false);

  const checkIsAtBottom = useCallback(() => {
    const el = messagesViewportRef.current;
    if (!el) return true;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD;
  }, []);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = 'instant') => {
      const el = messagesViewportRef.current;
      if (!el) return;
      if (behavior === 'smooth') {
        const version = ++smoothScrollVersionRef.current;
        isSmoothScrollingRef.current = true;
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        const onEnd = () => {
          // Ignore stale callbacks from cancelled animations
          if (smoothScrollVersionRef.current !== version) return;
          isSmoothScrollingRef.current = false;
          isAtBottomRef.current = checkIsAtBottom();
        };
        el.addEventListener('scrollend', onEnd, { once: true });
        setTimeout(onEnd, 600);
      } else {
        el.scrollTop = el.scrollHeight;
      }
    },
    [checkIsAtBottom],
  );

  const [isAtBottom, setIsAtBottom] = useState(true);

  const handleScroll = useCallback(() => {
    const atBottom = checkIsAtBottom();
    isAtBottomRef.current = atBottom;
    setIsAtBottom(atBottom);
  }, [checkIsAtBottom]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let prevHeight = vv.height;

    const onResize = () => {
      const el = messagesViewportRef.current;
      if (!el) return;

      const newHeight = vv.height;
      const delta = prevHeight - newHeight;
      prevHeight = newHeight;

      if (Math.abs(delta) < 1) return;

      if (isAtBottomRef.current) el.scrollTop = el.scrollHeight;
      else if (delta > 0) el.scrollTop += delta;
    };

    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, [scrollToBottom]);

  // Immediately disengage autoscroll on any intentional upward scroll gesture
  useEffect(() => {
    const el = messagesViewportRef.current;
    if (!el) return;

    const isScrollable = () => el.scrollHeight > el.clientHeight + 1;

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0 && isAtBottomRef.current && isScrollable()) {
        isAtBottomRef.current = false;
        setIsAtBottom(false);
      }
    };

    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      const deltaY = touchStartY - e.touches[0].clientY;
      if (deltaY < 0 && isAtBottomRef.current && isScrollable()) {
        isAtBottomRef.current = false;
        setIsAtBottom(false);
      }
    };

    el.addEventListener('wheel', onWheel, { passive: true });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  const lastMessageData = messages[messages.length - 1]?.data;
  useLayoutEffect(() => {
    if (isAtBottomRef.current) {
      scrollToBottom();
    }
  }, [messages, lastMessageData, scrollToBottom]);

  useEffect(() => {
    if (scrollRequested > 0 && !isInitializing) {
      isAtBottomRef.current = true;
      scrollToBottom('smooth');
    }
  }, [scrollRequested, scrollToBottom, isInitializing]);

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

  const inputEffectsRef = useRef<HTMLDivElement>(null);
  const [inputEffectsHeight, setInputEffectsHeight] = useState(0);

  useLayoutEffect(() => {
    const handleResize = () => {
      setInputEffectsHeight(inputEffectsRef.current?.clientHeight ?? 0);
    };
    const observer = new ResizeObserver(() => handleResize());
    if (inputEffectsRef.current) observer.observe(inputEffectsRef.current);
    handleResize();
    return () => observer.disconnect();
  }, []);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [chatContainerHeight, setChatContainerHeight] = useState(600);

  useLayoutEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setChatContainerHeight(el.clientHeight);
    });
    observer.observe(el);
    setChatContainerHeight(el.clientHeight);
    return () => observer.disconnect();
  }, []);

  // TODO - this kinda yughhhhhhhhhh
  const messageOpacities = new Map<string, number>();
  let hasHitEdit = false;
  for (const message of messages) {
    if (!editing && !insertingAfter) {
      messageOpacities.set(message.id, 1);
    } else if (message.id === editing?.id) {
      hasHitEdit = true;
      messageOpacities.set(message.id, 1);
    } else if (!hasHitEdit || !truncating) {
      messageOpacities.set(message.id, 0.5);
    } else {
      messageOpacities.set(message.id, 0.1);
    }
  }

  const isNewChat = currentChat === null && !isInitializing;
  const isTemporary = temporary || currentChat?.temporary;
  const isIncognito = incognito || currentChat?.incognito;

  useEffect(() => {
    if (isNewChat) {
      setTimeout(() => setHasBeenNewChat(true)); // TODO - even more yughhhhhhhhhhhh (see eslint when removing the timeout)
    }
  }, [isNewChat]);

  const topbar = (fixed: boolean) => {
    return (
      <Group
        pos={fixed ? 'fixed' : 'sticky'}
        top={0}
        left={0}
        right={0}
        bottom={fixed ? undefined : 0}
        p={10}
        gap={5}
        display={isMobile ? undefined : 'none'}
        style={{
          zIndex: 'var(--mantine-z-index-app)',
          backgroundColor: 'color-mix(in srgb, var(--mantine-color-body), transparent 15%)',
          backdropFilter: 'blur(5px)',
          boxShadow: shadow,
          borderBottom: '1px solid var(--mantine-color-default-border)',
        }}
        className="topbar"
      >
        <Burger
          opened={isSidebarOpen}
          onClick={() => setSidebarOpen(!isSidebarOpen)}
          display={!isMobile || isSidebarOpen ? 'none' : undefined}
          size="sm"
        />
        <Group justify="space-between" flex={1}>
          <Group gap={4}>
            <Tooltip label="New Chat" position="bottom" color="gray">
              <ActionIcon
                size={32}
                variant="subtle"
                c="dimmed"
                bdrs="md"
                className="nav-link-like filled"
                onClick={() => void setCurrentChat(null)}
                data-active={!currentChat}
              >
                <Icon icon="lucide:message-circle-plus" height={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
          <Group gap={4}>
            <Tooltip label="Temporary" position="bottom" color="gray">
              <ActionIcon
                size={32}
                variant="subtle"
                c="dimmed"
                bdrs="md"
                className="nav-link-like filled"
                onClick={() => void setTemporary(!isTemporary)}
                data-active={isTemporary}
              >
                <Icon icon="lucide:list-x" height={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Anonymous" position="bottom" color="gray">
              <ActionIcon
                size={32}
                variant="subtle"
                c="dimmed"
                bdrs="md"
                className="nav-link-like filled"
                onClick={() => void setIncognito(!isIncognito)}
                data-active={isIncognito}
              >
                <Icon icon="lucide:user-x" height={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Group>
    );
  };

  return (
    <Stack h="100%" gap={0} px={!isInputMaxWidth && !currentChat ? 20 : 0}>
      {isMobile && topbar(true)}
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
              viewportRef={messagesViewportRef}
              onScrollPositionChange={handleScroll}
              h="100%"
              styles={{
                scrollbar: {
                  zIndex: 'calc(var(--mantine-z-index-app) + 1)',
                },
              }}
            >
              {topbar(false)}
              <Stack pt={10} px={20} m="0 auto" maw={860} gap={10}>
                {!isInitializing && (
                  <>
                    {messages.map((message) => (
                      <Message
                        key={message.id}
                        message={message}
                        opacity={messageOpacities.get(message.id)!}
                      />
                    ))}
                    <Box mb={20}>
                      <Actions />
                    </Box>
                  </>
                )}
              </Stack>
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

        {/* Scroll-to-bottom button — visible when autoscroll is paused */}
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
                position: 'absolute',
                bottom: inputEffectsHeight + 16,
                right: 20,
                zIndex: 'calc(var(--mantine-z-index-app) + 1)',
                boxShadow: shadow,
                ...styles,
              }}
              onClick={() => {
                isAtBottomRef.current = true;
                scrollToBottom('smooth');
              }}
            >
              <Icon icon="lucide:chevrons-down" height={18} />
            </ActionIcon>
          )}
        </Transition>

        {/* InputEffects overlay — sits at the bottom of the scroll area */}
        <Group
          pos="absolute"
          bottom={0}
          left={0}
          right={0}
          justify="center"
          p={isInputMaxWidth ? 0 : '0 10px'}
          style={{
            pointerEvents: 'none',
          }}
        >
          <div style={{ width: '100%', maxWidth: inputMaxWidth }}>
            <Group gap={3} pb={3} ref={inputEffectsRef}>
              {editing && (
                <InputEffect
                  content={
                    <>
                      Editing{' '}
                      <span style={{ color: '#aaa' }}>
                        {scrubText(extractText(editing.data), 20)}
                      </span>
                    </>
                  }
                  onDelete={() => setEditing(null)}
                />
              )}
              {truncating && (
                <InputEffect content={'Overwriting newer'} onDelete={() => setTruncating(false)} />
              )}
              {insertingAfter && (
                <InputEffect
                  content={
                    <>
                      Inserting after{' '}
                      <span style={{ color: '#aaa' }}>
                        {scrubText(extractText(insertingAfter.data), 20)}
                      </span>
                    </>
                  }
                  onDelete={() => setInsertingAfter(null)}
                />
              )}
              {files.map((file) => (
                <InputEffect
                  content={
                    <Attachments
                      list={[{ name: file.name, mime: file.type, url: URL.createObjectURL(file) }]}
                      width={inputMaxWidth}
                      maxHeight={chatContainerHeight}
                      size={22}
                    />
                  }
                  onDelete={() => removeFile(file)}
                  key={file.name}
                />
              ))}
            </Group>
          </div>
        </Group>
      </Box>

      {/* Input area */}
      <Box
        w="100%"
        maw={inputMaxWidth}
        m={`0 auto ${!isNewChat && isInputMaxWidth ? 20 : 0} auto`}
        p={isInputMaxWidth ? 0 : '0 10px 10px 10px'}
        ref={inputRef}
      >
        <Input style={{ boxShadow: shadow, borderRadius: 10 }} />
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
