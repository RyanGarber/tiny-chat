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
      const hasText = texts(message.data).trim().length > 0;
      return (
        <Group w="100%" justify="end" ref={containerRef} style={style}>
          <Stack gap={5} w="fit-content">
            {hasText && (
              <Box
                px={20}
                py={10}
                bdrs="lg"
                className="user-message"
                style={{ boxShadow: shadow, alignSelf: 'flex-end' }}
              >
                <MessageBodyContent message={message} containerWidth={containerWidth} />
              </Box>
            )}
            {uploads.length !== 0 && (
              <Group
                gap={5}
                c="dimmed"
                mt={15}
                mb={hasText ? -45 : 0}
                pr={hasText ? 200 : 0}
                style={{ alignSelf: 'flex-start' }}
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
        <Box display="inline">
          <MessageBodyContent message={message} containerWidth={containerWidth} />
          {message.state.any &&
            !message.data.some((p, index) => {
              const isLast = index === message.data.length - 1;
              return (
                (p.type === 'thought' && message.state.thinking && isLast) ||
                (p.type === 'toolCall' &&
                  !message.data.some((pr) => pr.type === 'toolResult' && pr.id === p.id))
              );
            }) && (
              <Box
                component="span"
                pt={message.data.length > 0 ? 'sm' : 0}
                pb="xs"
                display="inline-block"
                style={{ verticalAlign: 'middle' }}
              >
                <Loader size="sm" type="dots" color="dimmed" />
              </Box>
            )}
        </Box>
      </Box>
    );
  },
  (prev, next) =>
    prev.message.data === next.message.data &&
    prev.message.state === next.message.state &&
    prev.style === next.style,
);

export default MessageBody;
