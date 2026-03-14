import { Box, Card, Divider, Group, Stack, Text } from '@mantine/core';
import { Icon } from '@iconify/react';
import { useChats } from '@/managers/chats.tsx';
import { extractText, scrubText } from '@/utils.ts';
import { zData } from '@tiny-chat/core-backend/src/types.ts';
import { RRule } from 'rrule';
import { format } from 'timeago.js';

export default function Actions() {
  const { actions } = useChats();
  return actions.length ? (
    <Card w="100%" px={20} py={10}>
      <Group w="100%" c="dimmed">
        <Icon icon="lucide:clock" />
        <Stack gap={0} flex={1}>
          {actions.map((action, i) => (
            <Box key={i}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto', // MAGIC LINE: forces col 1 to 0 if needed
                  gap: '8px',
                  width: '100%',
                  alignItems: 'center',
                }}
              >
                <Text
                  size="sm"
                  style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {scrubText(extractText(zData.parse(action.data)))}
                </Text>
                <Text size="sm" style={{ whiteSpace: 'nowrap' }}>
                  {format(RRule.fromString(action.schedule).after(new Date())!)}
                </Text>
              </div>
              {i !== actions.length - 1 && <Divider my="xs" />}
            </Box>
          ))}
        </Stack>
      </Group>
    </Card>
  ) : undefined;
}
