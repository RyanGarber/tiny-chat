import { Icon } from '@iconify/react';
import {
  Badge,
  Box,
  Button,
  FloatingPosition,
  Loader,
  Popover,
  ScrollAreaAutosize,
  Stack,
  ThemeIcon,
  Typography,
  Text,
  Card,
} from '@mantine/core';
import { zDataPart } from '@tiny-chat/shared/src/types/chat.ts';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Markdown } from './Markdown';
import { useAutoScroll } from '@/core/hooks/useAutoScroll';
import { JsonTree } from '@gfazioli/mantine-json-tree';
import { glassStyle } from '@/utils/glass';

export default function MessageBodyPopover({
  width,
  button,
  dropdown,
  defaultOpened,
  defaultBottom,
}: {
  width: number | string;
  button: ReactNode;
  dropdown: ReactNode;
  defaultOpened?: boolean;
  defaultBottom?: boolean;
}) {
  const [opened, setOpened] = useState(defaultOpened);

  const [maxHeight, setMaxHeight] = useState(400);
  const [position, setPosition] = useState<FloatingPosition>('bottom');

  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    (() => setOpened(defaultOpened ?? false))();
  }, [defaultOpened]);

  const { viewportRef, scrollToBottom } = useAutoScroll({
    scrollRequested: 0,
    isInitializing: false,
  });

  useEffect(() => {
    if (opened && defaultBottom) scrollToBottom('smooth');
  }, [opened, defaultBottom, scrollToBottom]);

  useEffect(() => {
    const updatePosition = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const isInBottomHalf = rect.top > window.innerHeight / 2;
      //const spaceLeft = rect.left;
      //const spaceRight = window.innerWidth - rect.right;
      //const prefersStart = spaceRight >= spaceLeft;
      if (isInBottomHalf) {
        setPosition('top');
      } else {
        setPosition('bottom');
      }
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [opened]);

  return (
    <Popover
      position={position}
      withArrow
      arrowSize={15}
      arrowPosition="center"
      arrowOffset={15}
      withOverlay
      shadow="md"
      offset={{ mainAxis: 15 }}
      width={width}
      withinPortal={false}
      transitionProps={{ duration: 0 }}
      styles={{
        dropdown: glassStyle,
      }}
      opened={opened}
      onChange={setOpened}
      middlewares={{
        shift: { padding: 10 },
        flip: true,
        size: {
          apply({ availableHeight, elements }) {
            const button = elements.reference as HTMLElement;
            const rect = button.getBoundingClientRect();
            const spaceAbove = rect.top;
            const spaceBelow = window.innerHeight - rect.bottom;
            const maxSpace = Math.max(spaceAbove, spaceBelow);
            setMaxHeight(Math.max(0, Math.min(availableHeight, maxSpace) - 130));
            elements.floating.style.maxWidth = `${Math.max(0, window.innerWidth - 24)}px`;
          },
        },
      }}
    >
      <Popover.Target>
        <Button
          variant={opened ? 'filled' : 'subtle'}
          size="xs"
          ref={buttonRef}
          onClick={() => setOpened(!opened)}
          my={10}
          style={{ display: 'inline-flex', verticalAlign: 'middle' }}
        >
          {button}
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <ScrollAreaAutosize mah={maxHeight} viewportRef={viewportRef}>
          <Typography style={{ overflowWrap: 'break-word' }}>{dropdown}</Typography>
        </ScrollAreaAutosize>
      </Popover.Dropdown>
    </Popover>
  );
}

export function ThoughtGroupPopover({
  thoughts,
  isThinkingActive,
  containerWidth,
}: {
  thoughts: string[];
  isThinkingActive: boolean;
  containerWidth: number;
}) {
  return (
    <MessageBodyPopover
      width={containerWidth + 20}
      //defaultOpened={isThinkingActive}
      defaultBottom={false}
      button={
        <>
          <ThemeIcon variant="transparent" size={22} mr={5}>
            <Icon icon="lucide:brain" height={18} />
          </ThemeIcon>
          {isThinkingActive ? 'Thinking' : 'Thought'}
          {isThinkingActive && <Loader ml={8} size={12} type="dots" color="currentColor" />}
        </>
      }
      dropdown={
        <Stack>
          {thoughts.map((thought, index) => (
            <Box
              key={index}
              py={10}
              pl={20}
              style={{
                borderLeft: '2px solid var(--mantine-color-default-border)',
              }}
            >
              <Markdown style={{ maxWidth: containerWidth - 15 }} source={thought} />
            </Box>
          ))}
        </Stack>
      }
    />
  );
}

export function ToolCallPopover({
  call,
  result,
  containerWidth,
}: {
  call: Extract<zDataPart, { type: 'toolCall' }>;
  result?: Extract<zDataPart, { type: 'toolResult' }>;
  containerWidth: number;
}) {
  return (
    <MessageBodyPopover
      width={containerWidth + 20}
      //defaultOpened={!call.name.startsWith("ask_") && !result}
      defaultBottom={false}
      button={
        <>
          <ThemeIcon variant="transparent" size={22} mr={5}>
            <Icon icon="lucide:braces" height={18} />
          </ThemeIcon>
          {!result ? 'Using' : 'Used'}
          <Badge
            variant="light"
            ml={4}
            size="xs"
            style={{ cursor: 'pointer' }}
            c={result?.error ? 'red' : undefined}
          >
            {call.name}
          </Badge>
          {!result && <Loader ml={8} size={12} type="dots" color="currentColor" />}
        </>
      }
      dropdown={
        <Stack>
          <Card withBorder w={containerWidth - 15}>
            <Text fw={500}>Input</Text>
            <JsonTree
              data={call.args as unknown}
              defaultExpanded
              withExpandAll
              withCopyToClipboard
            />
          </Card>
          <Card withBorder w={containerWidth - 15}>
            <Text fw={500}>Output</Text>
            <JsonTree
              data={result?.value as unknown}
              defaultExpanded
              withExpandAll
              withCopyToClipboard
            />
          </Card>
        </Stack>
      }
    />
  );
}
