import { Box, Group, Loader, Stack } from '@mantine/core';
import { useElementSize } from '@mantine/hooks';
import { MessageState } from '@tiny-chat/shared/src/types/chat.ts';
import { texts } from '@tiny-chat/shared/src/utils.ts';
import { MessageBodyContent } from '@/features/message/components/MessageBodyContent';
import { useLayout } from '@/stores/layout.tsx';
import { Author } from '@tiny-chat/backend/generated/prisma/enums.ts';
import { useMessageStream } from '@/features/message/hooks/useStreaming';
import { CSSProperties, memo } from 'react';
import { glassStyle } from '@/utils/glass';

const MessageBody = memo(
  function MessageBody({ message, style }: { message: MessageState; style?: CSSProperties }) {
    // For model messages, prefer the live stream snapshot when streaming so
    // the loader dots and pending-tool detection are accurate token-by-token.
    const stream = useMessageStream(message.author === Author.MODEL ? message.id : undefined);
    const live = stream ?? message;
    const parts = live.data.flat();

    const shadow = useLayout((s) => s.shadow);

    const { ref: containerRef, width: containerWidth } = useElementSize();

    if (message.author === Author.USER) {
      const hasText = texts(message.data).trim().length > 0;
      return (
        <Group w="100%" justify="end" ref={containerRef} style={style}>
          <Stack gap={5} w="fit-content">
            {hasText && (
              <Box
                px={20}
                py={10}
                bdrs={20}
                className="user-message"
                style={{ boxShadow: shadow, alignSelf: 'flex-end', ...glassStyle }}
              >
                <MessageBodyContent message={message} containerWidth={containerWidth} />
              </Box>
            )}
            {/* {uploads.length !== 0 && (
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
            )} */}
          </Stack>
        </Group>
      );
    } // no thinking or generating for user messages

    return (
      <Box w="100%" ref={containerRef} style={style}>
        <Box display="inline">
          <MessageBodyContent message={message} containerWidth={containerWidth} />
          {live.state.any &&
            !parts.some((p, index) => {
              const isLast = index === parts.length - 1;
              return (
                (p.type === 'thought' && live.state.thinking && isLast) ||
                (p.type === 'toolCall' &&
                  !parts.some((pr) => pr.type === 'toolResult' && pr.id === p.id))
              );
            }) && (
              <Box
                component="span"
                pt={parts.length > 0 ? 'sm' : 0}
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
