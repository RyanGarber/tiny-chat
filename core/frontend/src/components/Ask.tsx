import { continueToolCall } from '@/managers/generation.ts';
import { ReactNode, useState } from 'react';
import {
  zReplyColor,
  zReplyDatetime,
  zReplyNumber,
  zReplyQuestion,
} from '@tiny-chat/core-backend/src/tools/reply.ts';
import {
  ActionIcon,
  Autocomplete,
  Box,
  Card,
  ColorInput,
  Group,
  NumberInput,
  Stack,
  Text,
} from '@mantine/core';
import { DatePicker, DateTimePicker, DateValue, TimePicker } from '@mantine/dates';
import { MessageOmitted, zDataPart } from '@tiny-chat/core-backend/src/types.ts';
import { Icon } from '@iconify/react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';

export default function Ask({
  message,
  part,
  result,
}: {
  message: MessageOmitted;
  part: Extract<zDataPart, { type: 'toolCall' }>;
  result?: Extract<zDataPart, { type: 'toolResult' }>;
  containerWidth: number;
}) {
  const [value, setValue] = useState<unknown>(undefined);

  let question = '';
  let answers: ReactNode;
  if (part.name === 'reply_question') {
    const ask = zReplyQuestion.parse(part.args);
    question = ask.question;
    answers = (
      <Autocomplete
        data={ask.suggestions}
        value={value as string | undefined}
        onChange={setValue}
      />
    );
  } else if (part.name === 'reply_color') {
    const ask = zReplyColor.parse(part.args);
    question = ask.question;
    answers = <ColorInput value={value as string | undefined} onChange={setValue} />;
  } else if (part.name === 'reply_number') {
    const ask = zReplyNumber.parse(part.args);
    question = ask.question;
    answers = <NumberInput value={value as string | number | undefined} onChange={setValue} />;
  } else if (part.name === 'reply_datetime') {
    const ask = zReplyDatetime.parse(part.args);
    question = ask.question;
    answers =
      ask.date && ask.time ? (
        <DateTimePicker value={value as DateValue | undefined} onChange={setValue} />
      ) : ask.date ? (
        <DatePicker value={value as DateValue | undefined} onChange={setValue} />
      ) : (
        <TimePicker value={value as string | undefined} onChange={setValue} />
      );
  }

  return (
    <Card mb={10} withBorder>
      <Stack gap="xs">
        <Box my={-20}>
          <ReactMarkdown skipHtml remarkPlugins={[remarkBreaks]}>
            {question}
          </ReactMarkdown>
        </Box>
        {!result ? (
          <Group gap="xs">
            <Box flex={1}>{answers}</Box>
            <ActionIcon
              variant="filled"
              onClick={() =>
                void continueToolCall(message.id, part.id, part.name, { user_response: value })
              }
            >
              <Icon icon="lucide:check" />
            </ActionIcon>
          </Group>
        ) : (
          <Text c="dimmed" fs="italic">
            {/* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access */}
            {String(result.value.user_response)}
          </Text>
        )}
      </Stack>
    </Card>
  );
}
