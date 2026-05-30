import type { zDataPart } from '@tiny-chat/shared/src/types/chat';
import { memo, useState, type ReactNode } from 'react';
import { Box, Group, Text, Collapse, Stack, Anchor } from '@mantine/core';
import { Icon } from '@iconify/react';
import { JsonTree } from '@gfazioli/mantine-json-tree';
import type {
  zSearchWebInput,
  zSearchWebOutput,
  zViewWebInput,
  zViewWebOutput,
} from '@tiny-chat/backend/src/tools/web';
import { openExternal } from '@/utils/ui';
import type {
  zAddMemoryInput,
  zAddMemoryOutput,
  zDeleteMemoryOutput,
  zSearchMemoryInput,
  zSearchMemoryOutput,
  zUpdateMemoryInput,
  zUpdateMemoryOutput,
} from '@tiny-chat/backend/src/tools/memory';
import { Markdown } from './Markdown';

const FZ = '14px';

export const ToolCall = memo(
  ({
    toolCall,
    toolResult,
  }: {
    toolCall: Extract<zDataPart, { type: 'toolCall' }>;
    toolResult?: Extract<zDataPart, { type: 'toolResult' }>;
  }) => {
    const [expanded, setExpanded] = useState(false);

    let status: ReactNode;
    let details: ReactNode;

    if (toolCall.name === 'search_web') {
      status = (
        <>
          {!toolResult ? 'Searching' : 'Searched'}{' '}
          <span style={{ fontWeight: 500 }}>{(toolCall.args as zSearchWebInput).query}</span>
          {!toolResult ? '...' : ''}
        </>
      );
      details = (
        <Stack>
          {(toolResult?.value as zSearchWebOutput)?.map((result) => (
            <Box key={result.id}>
              <Text fw={500} fz={FZ}>
                {result.title}
              </Text>
              <Anchor
                truncate="end"
                href={result.source}
                target="_blank"
                style={{
                  display: 'block',
                }}
                onClick={(e) => {
                  e.preventDefault();
                  void openExternal(result.source);
                }}
              >
                {result.source}
              </Anchor>
              <Text truncate="end" fz={FZ}>
                {result.content}
              </Text>
            </Box>
          ))}
        </Stack>
      );
    } else if (toolCall.name === 'view_web') {
      status = (
        <>
          {!toolResult ? 'Reading' : 'Read'}{' '}
          <span style={{ fontWeight: 500 }}>{(toolCall.args as zViewWebInput).url}</span>
          {!toolResult ? '...' : ''}
        </>
      );
      details = (
        <Markdown source={(toolResult?.value as zViewWebOutput).content} style={{ fontSize: FZ }} />
      );
    } else if (toolCall.name === 'search_memory') {
      status = (
        <>
          {!toolResult ? 'Recalling' : 'Recalled'}{' '}
          <span style={{ fontWeight: 500 }}>{(toolCall.args as zSearchMemoryInput).query}</span>
          {!toolResult ? '...' : ''}
        </>
      );
      details = (
        <Stack>
          {(toolResult?.value as zSearchMemoryOutput)?.map((result, i) => (
            <Text key={i} fz={FZ}>
              {result.split(':').slice(1).join(':')}
            </Text>
          ))}
        </Stack>
      );
    } else if (
      toolCall.name === 'add_memory' ||
      toolCall.name === 'update_memory' ||
      toolCall.name === 'delete_memory'
    ) {
      status = (
        <>
          {!toolResult ? 'Remembering...' : 'Remembered'}{' '}
          <span style={{ fontWeight: 500 }}>
            {(toolCall.args as zAddMemoryInput | zUpdateMemoryInput).fact}
          </span>
          {!toolResult ? '...' : ''}
        </>
      );
      if (toolCall.name === 'add_memory') {
        details = (
          <Text fz={FZ}>
            Created memory with ID: {(toolResult?.value as zAddMemoryOutput).created_memory_id}.
          </Text>
        );
      } else if (toolCall.name === 'update_memory') {
        details = (
          <Text fz={FZ}>
            Updated memory with ID: {(toolResult?.value as zUpdateMemoryOutput).updated_memory_id}.
          </Text>
        );
      } else if (toolCall.name === 'delete_memory') {
        details = (
          <Text fz={FZ}>
            Removed memory with ID: {(toolResult?.value as zDeleteMemoryOutput).deleted_memory_id}.
          </Text>
        );
      }
    } else {
      status = (
        <>
          {!toolResult ? 'Using' : 'Used'} <span style={{ fontWeight: 500 }}>{toolCall.name}</span>
          {!toolResult ? '...' : ''}
        </>
      );
      details = (
        <Stack>
          <Text fz={FZ}>Input</Text>
          <JsonTree data={toolCall.args as unknown} withCopyToClipboard />
          <Text fz={FZ}>Output</Text>
          <JsonTree data={toolResult?.value as unknown} withCopyToClipboard />
        </Stack>
      );
    }

    return (
      <Box my={10}>
        <Group
          className={`shimmer-text ${!toolResult ? 'active' : ''}`}
          onClick={() => setExpanded(!expanded)}
          style={{ cursor: 'pointer' }}
          gap="xs"
          wrap="nowrap"
        >
          <Icon icon="lucide:wrench" height={18} color="var(--mantine-color-dimmed)" />
          <Text truncate="end" fz={FZ}>
            {status}
          </Text>
        </Group>
        <Collapse expanded={expanded}>
          <Box
            style={{ borderLeft: '2px solid var(--mantine-color-default-border)' }}
            px="lg"
            py="xs"
            ml={8}
          >
            {details}
          </Box>
        </Collapse>
      </Box>
    );
  },
);
