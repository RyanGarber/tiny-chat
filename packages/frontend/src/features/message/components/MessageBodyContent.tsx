import { useMessagingStore } from '@/features/chat/stores/useMessagingStore';
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Group,
  Image,
  Portal,
  Stack,
  Text,
  Transition,
} from '@mantine/core';
import { type CSSProperties, memo, ReactNode, useMemo } from 'react';
import { useMessageSelection } from '@/features/message/hooks/useMessageSelection';
import { Author, MessageState, zDataPart } from '@tiny-chat/shared/src/types/chat.ts';
import { texts } from '@tiny-chat/shared/src/utils.ts';
import { Markdown } from '@/features/message/components/Markdown';
import { Icon } from '@iconify/react';
import { ToolCallInput } from '@/features/message/components/ToolCallInput';
import { MediaPlayer, MediaProvider } from '@vidstack/react';
import {
  DefaultAudioLayout,
  defaultLayoutIcons,
  DefaultVideoLayout,
} from '@vidstack/react/player/layouts/default';
import { GenerateService } from '@/features/message/services/GenerateService';
import { useMessageStream } from '@/features/message/hooks/useStreaming';
import { useMessages } from '@/features/message/hooks/useMessages';
import { useChat } from '@/features/chat/hooks/useChat';
import { useMemories } from '@/features/chat/hooks/useMemories';
import { useActions } from '@/features/chat/hooks/useActions';
import { useThemes } from '@/features/settings/hooks/useThemes';
import { useTools } from '@/features/config/hooks/useTools.ts';
import { useProviders } from '@/features/config/hooks/useProviders.ts';
import { useSkills } from '@/features/uploads/hooks/useSkills';
import { Thinking } from './Thinking';
import { ToolCall } from './ToolCall';
import { SHADOW } from '@/utils/theme';
import {
  SearchWeb,
  ViewWeb,
  zSearchWebOutput,
  zViewWebOutput,
} from '@tiny-chat/backend/src/tools/web.ts';

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
    const { chat } = useChat();
    const { theme } = useThemes();

    const stream = useMessageStream(message.author === Author.MODEL ? message.id : undefined);
    const live = stream ?? message;
    const isGenerating = live.state.generating;

    const addQuote = useMessagingStore((s) => s.addQuote);

    const { rect, captureSelection, getSelectedText } = useMessageSelection(message.id);

    const isSelected = rect !== null;

    const handleQuoteClick = () => {
      const text = getSelectedText();
      if (text) addQuote(message, text);
    };

    const messages = useMessages();
    const messageList = useMemo(
      () => messages.data?.pages.flatMap((m) => m.messages) ?? [],
      [messages.data],
    );

    const webContext = useMemo(
      () =>
        messageList.flatMap((m) =>
          m.data
            .flat()
            .filter(
              (p): p is Extract<zDataPart, { type: 'toolResult' }> =>
                p.type === 'toolResult' && !p.error,
            )
            .flatMap((p) => {
              if (p.name === SearchWeb.name && p.value[0]?.type === 'json') {
                return p.value[0].value as zSearchWebOutput;
              } else if (p.name === ViewWeb.name && p.value[0]?.type === 'json') {
                return p.value[0].value as zViewWebOutput;
              }
              return [];
            }),
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
          <Markdown
            source={texts(message.data, '\n')}
            boxProps={{ style: { maxWidth: containerWidth - 40 } }}
          />
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

        const isThinkingActive = live.state.thinking && end === parts.length - 1;
        renderedParts.push(
          <Thinking
            key={`thought-${i}`}
            thoughts={groupedThoughts}
            isThinking={isThinkingActive}
            context={{
              webReferences: webContext,
              memoryReferences: memories.data ?? [],
              actionReferences: actions.data ?? [],
              isGenerating: isGenerating,
            }}
          />,
        );

        i = end;
      } else if (part.type === 'toolCall') {
        const result = parts.find(
          (p): p is Extract<zDataPart, { type: 'toolResult' }> =>
            p.type === 'toolResult' && p.id === part.id,
        );

        renderedParts.push(<ToolCall key={i} toolCall={part} toolResult={result} />);

        const tool = tools.find((t) => t.name === part.name);
        if (tool?.userInput || tool?.requirements?.approval) {
          renderedParts.push(
            <ToolCallInput
              key={`${i}-tci`}
              message={message}
              part={part}
              result={result}
              containerWidth={containerWidth}
              tool={tool}
            />,
          );
        }
      } else if (part.type === 'text') {
        if (part.value.trim() !== '') {
          renderedParts.push(
            <Markdown
              key={i}
              source={part.value}
              context={{
                webReferences: webContext,
                memoryReferences: memories.data ?? [],
                actionReferences: actions.data ?? [],
                isGenerating: isGenerating,
              }}
            />,
          );
        }
      } else if (part.type === 'file') {
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
      } else if (part.type === 'abort') {
        renderedParts.push(
          <Alert
            mb={10}
            key={i}
            color={part.reason === 'error' ? 'red' : 'gray'}
            variant="light"
            title={part.reason === 'error' ? 'Failed' : 'Stopped'}
          >
            <Stack align="flex-end">
              <Text fz="15px" w="100%">
                {part.message ?? `Response ended due to ${part.reason}.`}
              </Text>
              <Button
                variant="subtle"
                color="dimmed"
                onClick={() => {
                  void (async () => {
                    await GenerateService.handle({
                      message,
                      activeChat: chat.data!,
                      tools: toolGroups,
                      skills,
                      providers: providers.data!,
                    });
                  })();
                }}
                leftSection={<Icon icon="lucide:refresh-cw" />}
              >
                Retry
              </Button>
            </Stack>
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
                      await GenerateService.handle({
                        message,
                        activeChat: chat.data!,
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
                size={32}
                style={{
                  position: 'fixed',
                  top: (rect?.top ?? 0) - 30,
                  left: (rect?.left ?? 0) + (rect?.width ?? 0) / 2,
                  transform: 'translateX(-50%)',
                  zIndex: 'var(--mantine-zindex-app)',
                  boxShadow: SHADOW,
                  ...styles,
                }}
                onMouseDown={captureSelection}
                onTouchStart={captureSelection}
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
