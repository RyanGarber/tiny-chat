import { useLayout } from '@/stores/layout.tsx';
import { useMessaging } from '@/stores/messaging.tsx';
import {
  ActionIcon,
  Autocomplete,
  Box,
  Card,
  ColorInput,
  Divider,
  Image,
  NumberInput,
  Portal,
  Stack,
  Text,
  Transition,
} from '@mantine/core';
import { useTextSelection } from '@mantine/hooks';
import React, { useEffect, useRef } from 'react';
import { applyHljsTheme } from '@/utils/highlight';
import { extractText } from '@/utils/text';
import { MessageOmitted, zDataPart } from '@tiny-chat/core-backend/src/types.ts';
import { useSettings } from '@/stores/settings.tsx';
import { continueToolCall } from '@/managers/generation';
import { Markdown } from '@/components/Markdown.tsx';
import { Author } from '@tiny-chat/core-backend/generated/prisma/enums.ts';
import { ThoughtGroupPopover, ToolCallPopover } from '@/components/MessageBodyPopover.tsx';
import { Icon } from '@iconify/react';
import {
  zAskColor,
  zAskDatetime,
  zAskNumber,
  zAskQuestion,
} from '@tiny-chat/core-backend/src/tools/ask.ts';
import { useStreamedLength } from '@/hooks/useStreamedLength.ts';
import { DatePicker, DateTimePicker, TimePicker } from '@mantine/dates';

export default function MessageBodyContent({
  message,
  containerWidth,
}: {
  message: MessageOmitted;
  containerWidth: number;
}) {
  const isGenerating = message.state.generating;

  // Build ordered segments (text blocks + inline images)
  const fullTextLength = message.data
    .filter((p) => p.type === 'text')
    .reduce((acc, s) => acc + s.value.length, 0);

  const { displayedLength } = useStreamedLength(fullTextLength, isGenerating);

  const { shadow } = useLayout();
  const { addQuote } = useMessaging();
  const { getCodeTheme } = useSettings();
  void applyHljsTheme(getCodeTheme());

  const container = useRef<HTMLDivElement>(null);

  const selection = useTextSelection();
  const selectedTextRef = useRef('');

  const isNodeInContainer = (node: Node | null): boolean => {
    if (!node || !container.current) return false;
    let current: Node | null = node;
    while (current) {
      if (current === container.current) return true;
      current = current.parentNode;
    }
    return false;
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
    selectedTextRef.current = window.getSelection()?.toString() ?? selection?.toString() ?? '';
  }, [isSelected, selection]);

  const captureSelectionForQuote = (e: React.MouseEvent | React.TouchEvent) => {
    // Keep text selected while pressing the quote button (notably on iOS Safari).
    e.preventDefault();
    selectedTextRef.current = window.getSelection()?.toString() ?? selection?.toString() ?? '';
  };

  const handleQuoteClick = () => {
    const text = (
      window.getSelection()?.toString() ??
      selectedTextRef.current ??
      selection?.toString() ??
      ''
    ).trim();
    if (text) addQuote(message, text);
  };

  if (message.author === Author.USER) {
    return (
      <Markdown source={extractText(message.data)} style={{ maxWidth: containerWidth - 40 }} />
    );
  }

  // Render parts
  let textOffset = 0;
  const renderedParts: React.ReactNode[] = [];
  for (let i = 0; i < message.data.length; i++) {
    const part = message.data[i];
    if (part.type === 'thought') {
      const groupedThoughts = [part.value];
      let end = i;
      while (end + 1 < message.data.length) {
        const nextPart = message.data[end + 1];
        if (nextPart.type !== 'thought') break;
        groupedThoughts.push(nextPart.value);
        end++;
      }

      const isThinkingActive = message.state.thinking && end === message.data.length - 1;
      renderedParts.push(
        <ThoughtGroupPopover
          key={`thought-${i}`}
          thoughts={groupedThoughts}
          isThinkingActive={isThinkingActive}
          containerWidth={containerWidth}
        />,
      );
      i = end;
    } else if (part.type === 'text') {
      if (displayedLength <= textOffset) break;
      if (part.value.trim() !== '') {
        const visibleText = part.value.slice(0, displayedLength - textOffset);
        renderedParts.push(<Markdown key={i} source={visibleText} />);
      }
      textOffset += part.value.length;
      if (displayedLength < textOffset) break; // still streaming this segment
    } else if (part.type === 'file' && part.mime?.startsWith('image/') && part.inline) {
      // Show the image as soon as all text before it has been revealed
      if (displayedLength >= textOffset) {
        renderedParts.push(
          <Image key={i} src={part.url} alt={part.name} radius="md" maw="100%" w="auto" my={4} />,
        );
      } else {
        break;
      }
    } else if (part.type === 'toolCall') {
      if (displayedLength >= textOffset) {
        const firstResult = message.data
          .filter((_, j) => j > i)
          .find((p) => p.type === 'toolResult');
        const matchingResults = message.data.filter(
          (p) => p.type === 'toolResult' && p.name === part.name && p.id === part.id,
        ) as Extract<
          zDataPart,
          {
            type: 'toolResult';
          }
        >[];
        const result = matchingResults.length === 1 ? matchingResults[0] : firstResult;
        renderedParts.push(
          <ToolCallPopover key={i} call={part} result={result} containerWidth={containerWidth} />,
        );
        if (!result) {
          if (part.name === 'ask_question') {
            const ask = zAskQuestion.parse(part.args);
            renderedParts.push(
              <Card key={`${i}a`} mb={10}>
                <Stack gap="xs">
                  <Text>{ask.question}</Text>
                  <Autocomplete
                    data={ask.suggestions}
                    onChange={(value) => {
                      void continueToolCall(message.id, part.id, part.name, value);
                    }}
                  />
                </Stack>
              </Card>,
            );
          } else if (part.name === 'ask_color') {
            const ask = zAskColor.parse(part.args);
            renderedParts.push(
              <Card key={`${i}a`} mb={10}>
                <Stack gap="xs">
                  <Text>{ask.question}</Text>
                  <ColorInput
                    onChange={(value) => {
                      void continueToolCall(message.id, part.id, part.name, value);
                    }}
                  />
                </Stack>
              </Card>,
            );
          } else if (part.name === 'ask_number') {
            const ask = zAskNumber.parse(part.args);
            renderedParts.push(
              <Card key={`${i}a`} mb={10}>
                <Stack gap="xs">
                  <Text>{ask.question}</Text>
                  <NumberInput
                    onChange={(value) => {
                      void continueToolCall(message.id, part.id, part.name, value);
                    }}
                  />
                </Stack>
              </Card>,
            );
          } else if (part.name === 'ask_datetime') {
            const ask = zAskDatetime.parse(part.args);
            renderedParts.push(
              <Card key={`${i}a`} mb={10}>
                <Stack gap="xs">
                  <Text>{ask.question}</Text>
                  {ask.date && ask.time ? (
                    <DateTimePicker
                      onChange={(value) => {
                        void continueToolCall(message.id, part.id, part.name, value);
                      }}
                    />
                  ) : ask.date ? (
                    <DatePicker
                      onChange={(value) => {
                        void continueToolCall(message.id, part.id, part.name, value);
                      }}
                    />
                  ) : (
                    <TimePicker
                      onChange={(value) => {
                        void continueToolCall(message.id, part.id, part.name, value);
                      }}
                    />
                  )}
                </Stack>
              </Card>,
            );
          }
        }
      }
    } else if (part.type === 'abort') {
      renderedParts.push(
        <Divider key={i} label="Stopped" size="md" styles={{ label: { fontSize: 14 } }} />,
      );
    }
  }

  return (
    <>
      <Box ref={container} className={isGenerating ? 'is-streaming' : ''} w="100%">
        {renderedParts}
        {/* Standalone cursor shown before the first characters arrive */}
        {isGenerating && renderedParts.length === 0 && (
          <span className="streaming-cursor-standalone">▋</span>
        )}
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
}
