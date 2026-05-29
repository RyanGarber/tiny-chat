import { useLayout } from '@/stores/layout.tsx';
import { useMessaging } from '@/stores/messaging.tsx';
import { ActionIcon, Alert, Box, Group, Image, Portal, Text, Transition } from '@mantine/core';
import {
  memo,
  MouseEvent,
  ReactNode,
  TouchEvent,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
} from 'react';
import { MessageState, zDataPart } from '@tiny-chat/shared/src/types/chat.ts';
import { texts } from '@tiny-chat/shared/src/utils.ts';
import { Markdown } from '@/features/message/components/Markdown';
import { Author } from '@tiny-chat/backend/generated/prisma/enums.ts';
import {
  ThoughtGroupPopover,
  ToolCallPopover,
} from '@/features/message/components/MessageBodyPopover';
import { Icon } from '@iconify/react';
import ToolInput from '@/features/message/components/ToolInput';
import { MediaPlayer, MediaProvider } from '@vidstack/react';
import {
  DefaultAudioLayout,
  defaultLayoutIcons,
  DefaultVideoLayout,
} from '@vidstack/react/player/layouts/default';
import { GenerateService } from '@/features/message/services/GenerateService';
import { useMessageStream } from '@/features/message/hooks/useStreaming';
import { SearchResult } from '@tiny-chat/shared/src/providers/web';
import { useMessages } from '@/features/message/hooks/useMessages';
import { useChat } from '@/features/chat/hooks/useChat';
import { useMemories } from '@/features/chat/hooks/useMemories';
import { useActions } from '@/features/chat/hooks/useActions';
import { useThemes } from '@/features/settings/hooks/useThemes';
import { useTools } from '@/features/input/hooks/useTools';
import { useProviders } from '@/features/input/hooks/useProviders';
import { useSkills } from '@/features/input/hooks/useSkills';

export const MessageBodyContent = memo(
  ({
    message,
    containerWidth,
    style,
  }: {
    message: MessageState;
    containerWidth: number;
    style?: CSSProperties;
  }) => {
    const { theme } = useThemes();

    const stream = useMessageStream(message.author === Author.MODEL ? message.id : undefined);
    const live = stream ?? message;
    const isGenerating = live.state.generating;

    const shadow = useLayout((s) => s.shadow);
    const addQuote = useMessaging((s) => s.addQuote);

    const container = useRef<HTMLDivElement>(null);

    //const selection = useTextSelection(); TODO - perf
    const selection = useMemo(
      () => ({
        isCollapsed: false,
        rangeCount: 0,
        anchorNode: null,
        focusNode: null,
        getRangeAt: (_: number) => ({
          getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
        }),
      }),
      [],
    );
    const selectedTextRef = useRef('');

    const activeChat = useChat();

    const isNodeInContainer = (node: Node | null): boolean => {
      if (!node) return false;
      const element = node.nodeType === 3 ? node.parentElement : (node as Element);
      return !!element?.closest(`[data-message-id="${message.id}"]`);
    };

    const isSelected =
      selection &&
      !selection.isCollapsed &&
      selection.rangeCount > 0 &&
      isNodeInContainer(selection.anchorNode) &&
      isNodeInContainer(selection.focusNode);

    let rect = { top: 0, left: 0, width: 0, height: 0 };
    if (isSelected) rect = selection.getRangeAt(0).getBoundingClientRect();

    useEffect(() => {
      if (!isSelected) return;
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      selectedTextRef.current = window.getSelection()?.toString() ?? selection?.toString() ?? '';
    }, [isSelected, selection]);

    const captureSelectionForQuote = (e: MouseEvent | TouchEvent) => {
      // Keep text selected while pressing the quote button (notably on iOS Safari).
      e.preventDefault();
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      selectedTextRef.current = window.getSelection()?.toString() ?? selection?.toString() ?? '';
    };

    const handleQuoteClick = () => {
      const text = (
        window.getSelection()?.toString() ??
        selectedTextRef.current ??
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        selection?.toString() ??
        ''
      ).trim();
      if (text) addQuote(message, text);
    };

    const messages = useMessages();
    const messageList = useMemo(
      () => messages.data?.pages.flatMap((m) => m.messages) ?? [],
      [messages.data],
    );

    const webSearchResults = useMemo(
      () =>
        messageList.flatMap((m) =>
          (
            m.data
              .flat()
              .filter(
                (p): p is Extract<zDataPart, { type: 'toolResult' }> =>
                  p.type === 'toolResult' && p.name === 'search_web' && !p.error,
              ) as { value: SearchResult[] }[]
          ).flatMap((p) => p.value),
        ),
      [messageList],
    );

    const { tools, toolGroups } = useTools();
    const { skills } = useSkills();

    const { providers } = useProviders();

    const memories = useMemories();
    const actions = useActions();

    if (message.author === Author.USER) {
      return (
        <Box className="selectable">
          <Markdown source={texts(message.data, '\n')} style={{ maxWidth: containerWidth - 40 }} />
        </Box>
      );
    }

    const parts = live.data.flat();

    // Render parts
    const renderedParts: ReactNode[] = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (part.type === 'thought') {
        const groupedThoughts = [part.value];
        let end = i;
        while (end + 1 < parts.length) {
          const nextPart = parts[end + 1];
          if (nextPart.type !== 'thought') break;
          groupedThoughts.push(nextPart.value);
          end++;
        }

        //if (groupedThoughts.filter((t) => t.trim() !== '').length === 0) {
        const isThinkingActive = live.state.thinking && end === parts.length - 1;
        renderedParts.push(
          <ThoughtGroupPopover
            key={`thought-${i}`}
            thoughts={groupedThoughts}
            isThinkingActive={isThinkingActive}
            containerWidth={containerWidth}
          />,
        );
        //}

        i = end;
      } else if (part.type === 'text') {
        if (part.value.trim() !== '') {
          renderedParts.push(
            <Markdown
              key={i}
              source={part.value}
              context={{
                webSearchResults,
                memories: memories.data ?? [],
                actions: actions.data ?? [],
                isGenerating,
              }}
            />,
          );
        }
      } else if (part.type === 'outputFile') {
        if (part.mime?.startsWith('image/')) {
          renderedParts.push(
            <Image
              key={i}
              src={`data:${part.mime};base64,${part.data}`}
              alt={part.name}
              radius="md"
              maw="100%"
              w="auto"
              my={4}
            />,
          );
        } else if (part.mime?.startsWith('audio/') || part.mime?.startsWith('video/')) {
          renderedParts.push(
            <MediaPlayer
              key={i}
              title={part.name}
              src={`data:${part.mime};base64,${part.data}`}
              crossOrigin
              playsInline
            >
              <MediaProvider></MediaProvider>
              <DefaultAudioLayout icons={defaultLayoutIcons} colorScheme={theme.data} />
              <DefaultVideoLayout icons={defaultLayoutIcons} colorScheme={theme.data} />
            </MediaPlayer>,
          );
        }
      } else if (part.type === 'toolCall') {
        const result = parts.find(
          (p): p is Extract<zDataPart, { type: 'toolResult' }> =>
            p.type === 'toolResult' && p.id === part.id,
        );

        renderedParts.push(
          <ToolCallPopover key={i} call={part} result={result} containerWidth={containerWidth} />,
        );

        const tool = tools.find((t) => t.name === part.name);
        if (tool?.userInput || tool?.requirements?.approval) {
          renderedParts.push(
            <ToolInput
              key={`${i}-tci`}
              message={message}
              part={part}
              result={result}
              containerWidth={containerWidth}
              tool={tool}
            />,
          );
        }
      } else if (part.type === 'abort') {
        renderedParts.push(
          <Alert
            key={i}
            color={part.reason === 'error' ? 'red' : 'gray'}
            variant="light"
            title={part.reason === 'error' ? 'Error' : 'Stopped'}
            icon={<Icon icon="lucide:circle-x" />}
            my={4}
          >
            <Group justify="space-between">
              <Text>{part.message ?? `Response ended due to ${part.reason}.`}</Text>
              <ActionIcon
                variant="subtle"
                onClick={() => {
                  void (async () => {
                    // TODO - move this to new hook
                    await GenerateService.onModelMessage({
                      message,
                      activeChat: activeChat.data!,
                      tools: toolGroups,
                      skills,
                      providers: providers.data!,
                    });
                  })();
                }}
              >
                <Icon icon="lucide:refresh-cw" />
              </ActionIcon>
            </Group>
          </Alert>,
        );
      }
    }

    // Stale message check: if a prior model message has a newer createdAt than this message
    const isStale =
      !live.state.any &&
      messageList.some(
        (m) =>
          m.author === Author.MODEL &&
          messageList.indexOf(m) < messageList.indexOf(message) &&
          new Date(m.createdAt).getTime() > new Date(message.createdAt).getTime(),
      );

    return (
      <>
        <Box
          ref={container}
          w="100%"
          data-message-id={message.id}
          display="inline"
          className="selectable"
          style={style}
        >
          {isStale && (
            <Alert variant="light" mb="lg">
              <Group justify="space-between">
                <Group>
                  <Icon icon="lucide:alert-circle" />
                  <Text>Edits in the chat may change this response</Text>
                </Group>
                <ActionIcon
                  variant="subtle"
                  onClick={() => {
                    void (async () => {
                      await GenerateService.onModelMessage({
                        message,
                        activeChat: activeChat.data!,
                        tools: toolGroups,
                        skills,
                        providers: providers.data!,
                      });
                    })();
                  }}
                >
                  <Icon icon="lucide:refresh-cw" />
                </ActionIcon>
              </Group>
            </Alert>
          )}
          {renderedParts}
        </Box>
        <Portal target={document.body}>
          <Transition
            mounted={isSelected ?? false}
            transition="fade"
            duration={100}
            timingFunction="ease"
          >
            {(styles) => (
              <ActionIcon
                variant="gradient"
                size={32}
                style={{
                  position: 'fixed',
                  top: rect.top - 30,
                  left: rect.left + rect.width / 2,
                  transform: 'translateX(-50%)',
                  zIndex: 'var(--mantine-zindex-app)',
                  boxShadow: shadow,
                  ...styles,
                }}
                onMouseDown={captureSelectionForQuote}
                onTouchStart={captureSelectionForQuote}
                onClick={handleQuoteClick}
              >
                <Icon icon="lucide:message-square-quote" height={16} />
              </ActionIcon>
            )}
          </Transition>
        </Portal>
      </>
    );
  },
);
