import { zDataPart } from '@tiny-chat/shared/src/types/chat';
import { memo, type ReactNode, useState } from 'react';
import { Anchor, Box, Collapse, Group, Image, Stack, Text } from '@mantine/core';
import { Icon } from '@iconify/react';
import { JsonTree } from '@gfazioli/mantine-json-tree';
import type {
  zSearchWebInput,
  zSearchWebOutput,
  zViewWebInput,
  zViewWebOutput,
} from '@tiny-chat/backend/src/tools/web';
import { openExternal } from '@/utils/api.ts';
import type {
  zAddMemoryInput,
  zAddMemoryOutput,
  zDeleteMemoryInput,
  zDeleteMemoryOutput,
  zSearchChatsInput,
  zSearchChatsOutput,
  zSearchMemoryInput,
  zSearchMemoryOutput,
  zUpdateMemoryInput,
  zUpdateMemoryOutput,
} from '@tiny-chat/backend/src/tools/memories';
import { Markdown } from './Markdown';
import { format } from 'timeago.js';
import {
  zAddActionInput,
  zAddActionOutput,
  zDeleteActionInput,
  zDeleteActionOutput,
  zListActionsOutput,
  zUpdateActionInput,
  zUpdateActionOutput,
} from '@tiny-chat/backend/src/tools/actions.ts';
import { scrubText } from '@tiny-chat/shared/src/utils.ts';
import {
  zListFilesInput,
  zListFilesOutput,
  zReadFileInput,
  zSearchFilesInput,
  zSearchFilesOutput,
  zShellExecInput,
  zShellExecOutput,
  zWriteFileInput,
} from '@tiny-chat/shared/src/tools/system.ts';
import { ChatService } from '@/features/chat/services/ChatService.ts';
import { useActions } from '@/features/chat/hooks/useActions.ts';
import {
  decodeTextLossy,
  isTextAdjacent,
  mimeExtension,
  mimeTypeFromExtension,
  pathName,
} from '@tiny-chat/shared/src/utils/files.ts';

const FZ = '14px';

export const ToolCall = memo(
  ({
    toolCall,
    toolResult,
  }: {
    toolCall: Extract<zDataPart, { type: 'toolCall' }>;
    toolResult?: Extract<zDataPart, { type: 'toolResult' }>;
  }) => {
    const actions = useActions();

    const [expanded, setExpanded] = useState(false);

    let status: ReactNode;
    let details: ReactNode;

    if (toolCall.name === 'search_web') {
      status = (
        <>
          {!toolResult ? 'Searching' : 'Searched'} web for{' '}
          <span style={{ fontWeight: 500 }}>{(toolCall.args as zSearchWebInput).query}</span>
          {!toolResult ? '...' : ''}
        </>
      );
      if (toolResult?.value?.[0].type === 'json') {
        details = (
          <Stack>
            {(toolResult?.value[0].value as zSearchWebOutput).map((result, i) => (
              <Box key={i}>
                <Text fw={500} fz={FZ}>
                  {result.title}
                </Text>
                <Anchor
                  truncate="end"
                  href={result.url}
                  target="_blank"
                  style={{
                    display: 'block',
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    void openExternal(result.url);
                  }}
                >
                  {result.url}
                </Anchor>
                <Text truncate="end" fz={FZ}>
                  {result.content}
                </Text>
              </Box>
            ))}
          </Stack>
        );
      }
    } else if (toolCall.name === 'view_web') {
      status = (
        <>
          {!toolResult ? 'Viewing' : 'Viewed'}{' '}
          <span style={{ fontWeight: 500 }}>
            {new URL((toolCall.args as zViewWebInput).url).hostname}
          </span>
          {!toolResult ? '...' : ''}
        </>
      );
      if (toolResult?.value?.[0].type === 'json') {
        const output = toolResult.value[0].value as zViewWebOutput;
        details = (
          <Stack>
            <Anchor
              fw={500}
              fz={FZ}
              target="_blank"
              href={output.url}
              onClick={(e) => {
                e.preventDefault();
                void openExternal(output.url);
              }}
            >
              {output.url}
            </Anchor>
            <Markdown
              source={`\`\`\` markdown\n${output.content ?? ''}\n\`\`\``}
              typographyProps={{ style: { fontSize: 10 } }}
            />
          </Stack>
        );
      }
    } else if (
      toolCall.name === 'add_action' ||
      toolCall.name === 'update_action' ||
      toolCall.name === 'delete_action'
    ) {
      status = (
        <>
          {toolCall.name === 'delete_action'
            ? !toolResult
              ? 'Canceling'
              : 'Canceled'
            : !toolResult
              ? 'Scheduling'
              : 'Scheduled'}{' '}
          action{' '}
          <span style={{ fontWeight: 500 }}>
            {scrubText(
              (toolCall.args as zAddActionInput | zUpdateActionInput).prompt ??
                (toolCall.args as zDeleteActionInput).reason,
            )}
          </span>
          {!toolResult ? '...' : ''}
        </>
      );
      if (toolResult?.value?.[0].type === 'json') {
        details = (
          <Text fz={FZ}>
            {toolCall.name === 'add_action'
              ? `Created action with ID: ${(toolResult?.value[0].value as zAddActionOutput).created_action_id}.`
              : toolCall.name === 'update_action'
                ? `Updated action with ID: ${(toolResult?.value[0].value as zUpdateActionOutput).updated_action_id}.`
                : toolCall.name === 'delete_action'
                  ? `Removed action with ID: ${(toolResult?.value[0].value as zDeleteActionOutput).deleted_action_id}.`
                  : ''}
          </Text>
        );
      }
    } else if (toolCall.name === 'list_actions') {
      status = (
        <>
          {!toolResult ? 'Checking' : 'Checked'} scheduled actions
          {!toolResult ? '...' : ''}
        </>
      );
      if (toolResult?.value?.[0].type === 'json') {
        details = (
          <Stack>
            {(toolResult?.value[0].value as zListActionsOutput).map((action, i) => (
              <Box key={i}>
                <Text fw={500} fz={FZ}>
                  {action.prompt}
                </Text>
                <Anchor
                  truncate="end"
                  href={`/#/${action.chatId}`}
                  target="_blank"
                  style={{
                    display: 'block',
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    ChatService.setChatId(action.chatId);
                  }}
                >
                  Go to chat
                </Anchor>
                {actions.data?.find((a) => a.id === action.id)?.nextRunAt && (
                  <Text truncate="end" fz={FZ}>
                    {format(actions.data.find((a) => a.id === action.id)!.nextRunAt!)}
                  </Text>
                )}
              </Box>
            ))}
          </Stack>
        );
      }
    } else if (toolCall.name === 'search_chats') {
      status = (
        <>
          {!toolResult ? 'Searching' : 'Searched'} chats for{' '}
          <span style={{ fontWeight: 500 }}>{(toolCall.args as zSearchChatsInput).query}</span>
          {!toolResult ? '...' : ''}
        </>
      );
      if (toolResult?.value?.[0].type === 'json') {
        details = (
          <Stack>
            {(toolResult?.value[0].value as zSearchChatsOutput).map((result, i) => (
              <Box key={i}>
                <Text fw={500} fz={FZ}>
                  {result.chatTitle}
                </Text>
                <Text truncate="end" fz={FZ}>
                  {result.snippet}
                </Text>
              </Box>
            ))}
          </Stack>
        );
      }
    } else if (
      toolCall.name === 'add_memory' ||
      toolCall.name === 'update_memory' ||
      toolCall.name === 'delete_memory'
    ) {
      status = (
        <>
          {!toolResult ? 'Remembering...' : 'Remembered'}{' '}
          <span style={{ fontWeight: 500 }}>
            {(toolCall.args as zAddMemoryInput | zUpdateMemoryInput).fact ??
              (toolCall.args as zDeleteMemoryInput).reason}
          </span>
          {!toolResult ? '...' : ''}
        </>
      );
      if (toolResult?.value?.[0].type === 'json') {
        details = (
          <Text fz={FZ}>
            {toolCall.name === 'add_memory'
              ? `Created memory with ID: ${(toolResult?.value[0].value as zAddMemoryOutput).created_memory_id}.`
              : toolCall.name === 'update_memory'
                ? `Updated memory with ID: ${(toolResult?.value[0].value as zUpdateMemoryOutput).updated_memory_id}.`
                : toolCall.name === 'delete_memory'
                  ? `Removed memory with ID: ${(toolResult?.value[0].value as zDeleteMemoryOutput).deleted_memory_id}.`
                  : ''}
          </Text>
        );
      }
    } else if (toolCall.name === 'search_memory') {
      status = (
        <>
          {!toolResult ? 'Searching' : 'Searched'} memories for{' '}
          <span style={{ fontWeight: 500 }}>{(toolCall.args as zSearchMemoryInput).query}</span>
          {!toolResult ? '...' : ''}
        </>
      );
      if (toolResult?.value?.[0].type === 'json') {
        details = (
          <Stack>
            {(toolResult?.value[0].value as zSearchMemoryOutput).map((result, i) => (
              <Stack gap={0}>
                <Text key={i} fz={FZ}>
                  {result.fact}
                </Text>
                <Text size="xs" c="dimmed">
                  (learned {format(result.createdAt)})
                </Text>
              </Stack>
            ))}
          </Stack>
        );
      }
    } else if (toolCall.name === 'read_file') {
      status = (
        <>
          {!toolResult ? 'Reading' : 'Read'} file{' '}
          <span style={{ fontWeight: 500 }}>
            {pathName((toolCall.args as zReadFileInput).path)}
          </span>
          {!toolResult ? '...' : ''}
        </>
      );
      if (toolResult?.value?.[0].type === 'file') {
        let content: ReactNode = undefined;
        if (toolResult?.value[0].mime.startsWith('image/')) {
          const uri = `data:${toolResult?.value[0].mime};base64,${toolResult?.value[0].data}`;
          content = <Image src={uri} />;
        } else if (isTextAdjacent(toolResult?.value[0].mime)) {
          const text = decodeTextLossy(toolResult?.value[0].data, toolResult?.value[0].mime);
          content = (
            <Markdown
              source={`\`\`\`${mimeExtension(toolResult?.value[0].mime, toolResult?.value[0].name)}\n${text}`}
            />
          );
        }
        if (content) {
          details = (
            <Stack>
              <Text fw={500} fz={FZ}>
                {(toolCall.args as zReadFileInput).path}
              </Text>
              {content}
            </Stack>
          );
        }
      }
    } else if (toolCall.name === 'write_file') {
      status = (
        <>
          {!toolResult ? 'Writing' : 'Wrote'} file{' '}
          <span style={{ fontWeight: 500 }}>
            {pathName((toolCall.args as zWriteFileInput).path)}
          </span>
          {!toolResult ? '...' : ''}
        </>
      );
      if (toolResult?.value[0]?.type === 'json') {
        const input = toolCall.args as zWriteFileInput;
        details = (
          <Stack>
            <Text fw={500} fz={FZ}>
              {input.path}
            </Text>
            <Markdown
              source={`\`\`\`${mimeExtension(mimeTypeFromExtension(input.path) ?? 'text/plain')}\n${input.content}`}
            />
          </Stack>
        );
      }
    } else if (toolCall.name === 'list_files') {
      status = (
        <>
          {!toolResult ? 'Looking' : 'Looked'} in folder{' '}
          <span style={{ fontWeight: 500 }}>
            {pathName((toolCall.args as zListFilesInput).path)}
          </span>
          {!toolResult ? '...' : ''}
        </>
      );
      if (toolResult?.value[0].type === 'json') {
        const output = toolResult?.value[0].value as zListFilesOutput;
        details = (
          <Stack>
            <Group gap="xs">
              <Text fw={500} fz={FZ}>
                {output.path}
              </Text>
              <Text c="dimmed" fz={FZ}>
                {output.files.length} item{output.files.length === 1 ? '' : 's'}
              </Text>
            </Group>
            {output.files.map((file, i) => (
              <Box key={i}>
                <Text truncate="end" fz={FZ}>
                  {pathName(file)}
                </Text>
              </Box>
            ))}
          </Stack>
        );
      }
    } else if (toolCall.name === 'search_files') {
      status = (
        <>
          {!toolResult ? 'Searching' : 'Searched'} files for{' '}
          <span style={{ fontWeight: 500 }}>{(toolCall.args as zSearchFilesInput).query}</span>
          {!toolResult ? '...' : ''}
        </>
      );
      if (toolResult?.value?.[0].type === 'json') {
        details = (
          <Stack>
            {(toolResult?.value[0].value as zSearchFilesOutput).map((upload, i) => (
              <Box key={i}>
                <Text fw={500} fz={FZ}>
                  {upload.path}
                </Text>
                <Text truncate="end" fz={FZ}>
                  {upload.snippet}
                </Text>
              </Box>
            ))}
          </Stack>
        );
      }
    } else if (toolCall.name.startsWith('ask_')) {
      status = <>{!toolResult ? 'Asking a question...' : 'Asked a question'}</>;
    } else if (toolCall.name === 'shell_exec') {
      status = (
        <>
          {!toolResult ? 'Running' : 'Ran'}{' '}
          <span style={{ fontWeight: 500 }}>
            {(toolCall.args as zShellExecInput).command.split(' ')[0]}
          </span>
          {!toolResult ? '...' : ''}
        </>
      );
      if (toolResult?.value[0]?.type === 'json') {
        const { stdout, stderr } = toolResult.value[0].value as zShellExecOutput;
        const output = [
          stdout ? `# stdout\n${stdout.trim()}` : '',
          stderr ? `# stderr\n${stderr.trim()}` : '',
        ].filter(Boolean);
        details = (
          <Markdown
            source={`\`\`\`shell\n# stdin\n${(toolCall.args as zShellExecInput).command.trim()}\n\n${output.join('\n\n')}\n\`\`\``}
          />
        );
      }
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
          <Text truncate="end" fz={FZ} c={toolResult?.error ? 'red' : undefined}>
            {status ?? (
              <>
                {!toolResult ? 'Using' : 'Used'}{' '}
                <span style={{ fontWeight: 500 }}>{toolCall.name}</span>
                {!toolResult ? '...' : ''}
              </>
            )}
          </Text>
        </Group>
        <Collapse expanded={expanded}>
          {expanded && (
            <Box
              style={{ borderLeft: '2px solid var(--mantine-color-default-border)' }}
              px="lg"
              py="xs"
              ml={8}
            >
              {details ?? (
                <Stack>
                  <Text fz={FZ}>Input</Text>
                  <JsonTree data={toolCall.args as unknown} withCopyToClipboard />
                  <Text fz={FZ}>Output</Text>
                  <JsonTree data={toolResult?.value} withCopyToClipboard />
                </Stack>
              )}
            </Box>
          )}
        </Collapse>
      </Box>
    );
  },
);
