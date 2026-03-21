import { Box, Group, Loader, Stack } from '@mantine/core';
import { useElementSize } from '@mantine/hooks';
import { MessageOmitted, texts } from '@tiny-chat/core-backend/src/types';
import MessageBodyContent from '@/components/MessageBodyContent.tsx';
import { useLayout } from '@/stores/layout.tsx';
import Attachments from '@/components/Attachments.tsx';
import { Author } from '@tiny-chat/core-backend/generated/prisma/enums.ts';
import { Icon } from '@iconify/react';
import { CSSProperties, memo } from 'react';

const MessageBody = memo(
  function MessageBody({ message, style }: { message: MessageOmitted; style?: CSSProperties }) {
    const { shadow } = useLayout();

    const { ref: containerRef, width: containerWidth } = useElementSize();

    if (message.author === Author.USER) {
      const uploads = message.data.filter((p) => p.type === 'upload');
      return (
        <Group w="100%" justify="end" ref={containerRef} style={style}>
          <Stack gap={5} w="fit-content">
            {texts(message.data).trim().length > 0 && (
              <Box px={20} py={10} bdrs="lg" className="user-message" style={{ boxShadow: shadow }}>
                <MessageBodyContent message={message} containerWidth={containerWidth} />
              </Box>
            )}
            {uploads.length !== 0 && (
              <Group
                gap={5}
                c="dimmed"
                mt={15}
                mb={texts(message.data).trim().length > 0 ? -45 : 0}
                style={{ zIndex: 'var(--mantine-z-index-app' }}
              >
                <Icon icon="lucide:paperclip" height={18} />
                <Attachments
                  list={uploads.map((u) => ({ name: u.name, image: u.thumbnail }))}
                  width={containerWidth}
                />
              </Group>
            )}
          </Stack>
        </Group>
      );
    } // no thinking or generating for user messages

    return (
      <Box w="100%" ref={containerRef} style={style}>
        <MessageBodyContent message={message} containerWidth={containerWidth} />
        {message.state.any && (
          <Box pt={message.data.length > 0 ? 'sm' : 0} pb="xs">
            <Loader size="sm" type="dots" color="dimmed" />
          </Box>
        )}
      </Box>
    );
  },
  (prev, next) =>
    prev.message.data === next.message.data &&
    prev.message.state === next.message.state &&
    prev.style === next.style,
);

export default MessageBody;
