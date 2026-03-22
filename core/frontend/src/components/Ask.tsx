import { continueToolCall } from '@/managers/generation.ts';
import { ReactNode, useState } from 'react';
import {
  zAskColor,
  zAskDatetime,
  zAskNumber,
  zAskQuestion,
} from '@tiny-chat/core-backend/src/tools/ask.ts';
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

  let question: ReactNode;
  let answers: ReactNode;
  if (part.name === 'ask_question') {
    const ask = zAskQuestion.parse(part.args);
    question = ask.question;
    answers = (
      <Autocomplete
        data={ask.suggestions}
        value={value as string | undefined}
        onChange={setValue}
      />
    );
  } else if (part.name === 'ask_color') {
    const ask = zAskColor.parse(part.args);
    question = ask.question;
    answers = <ColorInput value={value as string | undefined} onChange={setValue} />;
  } else if (part.name === 'ask_number') {
    const ask = zAskNumber.parse(part.args);
    question = ask.question;
    answers = <NumberInput value={value as string | number | undefined} onChange={setValue} />;
  } else if (part.name === 'ask_datetime') {
    const ask = zAskDatetime.parse(part.args);
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
        <Text fw={500}>{question}</Text>
        {!result ? (
          <Group gap="xs">
            <Box flex={1}>{answers}</Box>
            <ActionIcon
              variant="filled"
              onClick={() => void continueToolCall(message.id, part.id, part.name, value)}
            >
              <Icon icon="lucide:check" />
            </ActionIcon>
          </Group>
        ) : (
          <Text c="dimmed" fs="italic">
            {String(result.value)}
          </Text>
        )}
      </Stack>
    </Card>
  );
}
