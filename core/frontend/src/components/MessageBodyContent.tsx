import { useLayout } from '@/stores/layout.tsx';
import { useMessaging } from '@/stores/messaging.tsx';
import { useChats } from '@/stores/chats.tsx';
import { ActionIcon, Box, Divider, Image, Portal, Transition } from '@mantine/core';
import { useTextSelection } from '@mantine/hooks';
import React, { useEffect, useMemo, useRef } from 'react';
import { applyHljsTheme } from '@/utils/highlight';
import { extractText } from '@/utils/text';
import { MessageOmitted, zDataPart } from '@tiny-chat/core-backend/src/types.ts';
import { useSettings } from '@/stores/settings.tsx';
import { Markdown } from '@/components/Markdown.tsx';
import { Author } from '@tiny-chat/core-backend/generated/prisma/enums.ts';
import { ThoughtGroupPopover, ToolCallPopover } from '@/components/MessageBodyPopover.tsx';
import { Icon } from '@iconify/react';
import { useStreamedLength } from '@/hooks/useStreamedLength.ts';
import Ask from '@/components/Ask.tsx';
import { SearchResult } from '@tiny-chat/core-backend/src/providers/search';

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

  const { messages } = useChats();
  const webSearchResults = useMemo(() => {
    const results = messages.flatMap((m) =>
      (
        m.data.filter(
          (p): p is Extract<zDataPart, { type: 'toolResult' }> =>
            p.type === 'toolResult' && p.name === 'search_web' && !p.error,
        ) as { value: SearchResult[] }[]
      ).flatMap((p) => p.value),
    );

    // Deduplicate by ID
    const seen = new Set<string>();
    return results.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }, [messages]);

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
        renderedParts.push(
          <Markdown key={i} source={visibleText} webSearchResults={webSearchResults} />,
        );
      }
      textOffset += part.value.length;
      if (displayedLength < textOffset) break; // still streaming this segment
    } else if (part.type === 'outputFile' && part.mime?.startsWith('image/')) {
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
        const result = message.data.find((p) => p.type === 'toolResult' && p.id === part.id) as
          | Extract<zDataPart, { type: 'toolResult' }>
          | undefined;

        renderedParts.push(
          <ToolCallPopover
            key={i}
            call={part}
            result={result}
            defaultOpened={!part.name.startsWith('ask_')}
            containerWidth={containerWidth}
          />,
        );

        if (part.name.startsWith('ask_')) {
          renderedParts.push(
            <Ask
              key={`${i}-ask`}
              message={message}
              part={part}
              result={result}
              containerWidth={containerWidth}
            />,
          );
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
      <Box ref={container} w="100%" data-message-id={message.id}>
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
}
