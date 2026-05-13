import Message from '@/components/Message.tsx';
import { Box, Stack } from '@mantine/core';
import Actions from '@/components/Actions.tsx';
import { useLayout } from '@/stores/layout.tsx';
import { useChats } from '@/stores/chats.tsx';
import { memo, useMemo } from 'react';
import { useMessaging } from '@/stores/messaging.tsx';

export const ChatMessages = memo(() => {
  const isInitializing = useLayout((s) => s.isInitializing);
  const messages = useChats((s) => s.messages);
  const editing = useMessaging((s) => s.editing);
  const insertingAfter = useMessaging((s) => s.insertingAfter);
  const truncating = useMessaging((s) => s.truncating);

  const messageOpacities = useMemo(() => {
    const map = new Map<string, number>();
    let hasHitEdit = false;
    for (const message of messages) {
      if (!editing && !insertingAfter) {
        map.set(message.id, 1);
      } else if (message.id === editing?.id) {
        hasHitEdit = true;
        map.set(message.id, 1);
      } else if (!hasHitEdit || !truncating) {
        map.set(message.id, 0.5);
      } else {
        map.set(message.id, 0.1);
      }
    }
    return map;
  }, [messages, editing, insertingAfter, truncating]);

  return (
    <Stack pt={10} px={20} m="0 auto" maw={860} gap={10}>
      {!isInitializing && (
        <>
          {messages.map((message) => (
            <Message
              key={message.id}
              message={message}
              opacity={messageOpacities.get(message.id) ?? 1}
            />
          ))}
          <Box mb={20}>
            <Actions />
          </Box>
        </>
      )}
    </Stack>
  );
});
