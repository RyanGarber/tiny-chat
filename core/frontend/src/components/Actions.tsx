import { Box, Card, Divider, Group, Stack, Text } from '@mantine/core';
import { Icon } from '@iconify/react';
import { useChats } from '@/stores/chats.tsx';
import { extractText, scrubText } from '@/utils/text';
import { zData } from '@tiny-chat/core-backend/src/types.ts';
import { format } from 'timeago.js';
import { Action } from '@tiny-chat/core-backend/generated/prisma/client.ts';
import { useEffect, useState } from 'react';
import { usePersistence } from '@/stores/persistence.tsx';

export default function Actions() {
  const { currentChat } = useChats();
  const { actions: allActions } = usePersistence();
  const actions = allActions.filter((a) => a.chatId === currentChat?.id);

  const [, tick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  return actions.length ? (
    <Card w="100%" px={20} py={10}>
      <Group w="100%" c="dimmed">
        <Icon icon="lucide:clock" />
        <Stack gap={0} flex={1}>
          {actions
            .filter(
              (a): a is Action & { nextRunAt: Date } => !!a.nextRunAt && a.nextRunAt > new Date(),
            )
            .map((action, i, array) => (
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
                    {format(action.nextRunAt)}
                  </Text>
                </div>
                {i !== array.length - 1 && <Divider my="xs" />}
              </Box>
            ))}
        </Stack>
      </Group>
    </Card>
  ) : undefined;
}
