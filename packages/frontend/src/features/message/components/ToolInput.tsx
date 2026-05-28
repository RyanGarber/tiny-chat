import { ReactNode, useEffect, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  ColorInput,
  Group,
  NumberInput,
  Stack,
  Text,
} from '@mantine/core';
import { DatePicker, DateTimePicker, DateValue, TimePicker } from '@mantine/dates';
import { MessageState, zDataPart } from '@tiny-chat/shared/src/types/chat.ts';
import { Icon } from '@iconify/react';
import {
  zReplyColorInput,
  zReplyColorOutput,
  zReplyDatetimeInput,
  zReplyDatetimeOutput,
  zReplyNumberInput,
  zReplyNumberOutput,
  zReplyQuestionInput,
  zReplyQuestionOutput,
} from '@/tools/reply';
import { Markdown } from '@/features/message/components/Markdown';
import { GenerateService } from '@/features/message/services/GenerateService';
import { useChat } from '@/features/chat/hooks/useChat';
import { zShellExecInput } from '@/tools/shell';
import { zWriteFileInput } from '@/tools/filesystem';
import { DIFF_MARKER } from '@/utils/text';
import { useTools } from '@/features/input/hooks/useTools';
import type { Tool } from '@tiny-chat/shared/src/types/tool.ts';
import type { z } from 'zod';
import { useProviders } from '@/features/input/hooks/useProviders';
import { useSkills } from '@/features/input/hooks/useSkills';
import { invoke } from '@/utils/api';

export default function ToolInput({
  message,
  part,
  result,
  tool,
}: {
  message: MessageState;
  part: Extract<zDataPart, { type: 'toolCall' }>;
  result?: Extract<zDataPart, { type: 'toolResult' }>;
  containerWidth: number;
  tool?: Tool<z.ZodAny, z.ZodAny, z.ZodAny>;
}) {
  const activeChat = useChat();

  const { providers } = useProviders();
  const { toolGroups } = useTools();
  const { skills } = useSkills();

  const [fileContents, setFileContents] = useState<string>('');
  const [answer, setAnswer] = useState<unknown>(undefined);

  useEffect(() => {
    if (part.name === 'write_file') {
      const write = zWriteFileInput.parse(part.args);
      invoke<string>('read_file', { path: write.path })
        .then((contents) => {
          setFileContents(contents);
        })
        .catch((error) => {
          console.error('Error reading file', error);
          setFileContents('');
        });
    }
  }, [part.name, part.args]);

  if (!tool && !result) {
    return (
      <Alert color="red" title="Error">
        Tool <code>{part.name}</code> not found
      </Alert>
    );
  }

  const approve = (children?: ReactNode) => {
    return (
      <Stack gap="xs">
        <Group gap="xs">
          <Button
            size="xs"
            onClick={() =>
              void GenerateService.onToolInput({
                seed: message,
                part,
                activeChat: activeChat.data!,
                tools: toolGroups,
                skills,
                providers: providers.data!,
                approved: true,
              })
            }
          >
            Approve
          </Button>
          <Button
            variant="default"
            size="xs"
            onClick={() =>
              void GenerateService.onToolInput({
                seed: message,
                part,
                activeChat: activeChat.data!,
                tools: toolGroups,
                skills,
                providers: providers.data!,
                approved: false,
              })
            }
          >
            Deny
          </Button>
        </Group>
        {children && <Box>{children}</Box>}
      </Stack>
    );
  };

  if (part.name === 'write_file') {
    if (result) return;
    const write = zWriteFileInput.parse(part.args);
    return approve(
      <Markdown
        source={`\`\`\`diff ${write.path}\n${fileContents}${DIFF_MARKER}${write.contents}\n\`\`\``}
      />,
    );
  }

  if (part.name === 'shell_exec') {
    if (result) return;
    const exec = zShellExecInput.parse(part.args);
    return approve(<Markdown source={`\`\`\`shell\n${exec.command}\n\`\`\``} />);
  }

  if (tool?.requirements?.approval && !tool.userInput) {
    return approve();
  }

  if (part.name.startsWith('reply_')) {
    let heading = '';
    let body: ReactNode;

    if (part.name === 'reply_question') {
      const ask = zReplyQuestionInput.parse(part.args);
      heading = ask.question;
      body = (
        <Autocomplete
          data={ask.suggestions}
          value={answer as string | undefined}
          onChange={(v) =>
            setAnswer({
              answer: v,
            } satisfies zReplyQuestionOutput)
          }
        />
      );
    } else if (part.name === 'reply_color') {
      const ask = zReplyColorInput.parse(part.args);
      heading = ask.question;
      body = (
        <ColorInput
          value={answer as string | undefined}
          onChange={(v) =>
            setAnswer({
              color: v,
            } satisfies zReplyColorOutput)
          }
        />
      );
    } else if (part.name === 'reply_number') {
      const ask = zReplyNumberInput.parse(part.args);
      heading = ask.question;
      body = (
        <NumberInput
          value={answer as string | number | undefined}
          onChange={(v) =>
            setAnswer({
              number: Number(v),
            } satisfies zReplyNumberOutput)
          }
        />
      );
    } else if (part.name === 'reply_datetime') {
      const ask = zReplyDatetimeInput.parse(part.args);
      heading = ask.question;
      body =
        ask.date && ask.time ? (
          <DateTimePicker
            value={answer as DateValue | undefined}
            onChange={(v) =>
              setAnswer({
                date: v!.split(' ')[0],
                time: v!.split(' ')[1],
              } satisfies zReplyDatetimeOutput)
            }
          />
        ) : ask.date ? (
          <DatePicker
            value={answer as DateValue | undefined}
            onChange={(v) =>
              setAnswer({
                date: v!,
              } satisfies zReplyDatetimeOutput)
            }
          />
        ) : (
          <TimePicker
            value={answer as string | undefined}
            onChange={(v) =>
              setAnswer({
                time: v,
              } satisfies zReplyDatetimeOutput)
            }
          />
        );
    }

    return (
      <Card mb={10} withBorder>
        <Stack gap="xs">
          <Box>
            <Markdown source={heading} />
          </Box>
          {!result ? (
            <Group gap="xs">
              <Box flex={1}>{body}</Box>
              <ActionIcon
                variant="filled"
                onClick={() =>
                  void GenerateService.onToolInput({
                    seed: message,
                    part,
                    activeChat: activeChat.data!,
                    tools: toolGroups,
                    skills,
                    providers: providers.data!,
                    value: answer,
                  })
                }
              >
                <Icon icon="lucide:check" />
              </ActionIcon>
            </Group>
          ) : (
            <Text c="dimmed" fs="italic">
              {result.value}
            </Text>
          )}
        </Stack>
      </Card>
    );
  }

  return (
    <Alert color="red" title="Error">
      Tool <code>{part.name}</code> not recognized
    </Alert>
  );
}
