import { Card, Group, Stack, Text } from '@mantine/core';
import { Icon } from '@iconify/react';
import { useChats } from '@/managers/chats.tsx';
import { extractText, scrubText } from '@/utils.ts';
import { zData } from '@tiny-chat/core-backend/src/types.ts';
import { RRule } from 'rrule';
import { format } from 'timeago.js';

export default function Actions() {
  const { actions } = useChats();
  return (
    actions.length && (
      <Card w="100%" px={20} py={10}>
        <Group w="100%" justify="space-between" c="dimmed">
          <Icon icon="lucide:clock" />
          <Stack gap={0} flex={1}>
            {actions.map((action, i) => (
              <Text key={i} size="sm" style={{ textOverflow: 'ellipsis' }}>
                {scrubText(extractText(zData.parse(action.data)))}
              </Text>
            ))}
          </Stack>
          <Stack gap={0}>
            {actions.map((action, i) => (
              <Text key={i} size="sm">
                {format(RRule.fromString(action.schedule).after(new Date())!)}
              </Text>
            ))}
          </Stack>
        </Group>
      </Card>
    )
  );
}
