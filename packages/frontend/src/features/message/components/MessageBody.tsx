import { Box, Group, Stack } from '@mantine/core';
import { useElementSize } from '@mantine/hooks';
import { MessageState } from '@tiny-chat/shared/src/types/chat.ts';
import { texts } from '@tiny-chat/shared/src/utils.ts';
import { MessageBodyContent } from '@/features/message/components/MessageBodyContent';
import { Author } from '@tiny-chat/backend/generated/prisma/enums.ts';
import { useMessageStream } from '@/features/message/hooks/useStreaming';
import { CSSProperties, memo } from 'react';
import { glassStyle } from '@/utils/glass';
import { SHADOW } from '@/utils/theme';

const MessageBody = memo(
  function MessageBody({ message, style }: { message: MessageState; style?: CSSProperties }) {
    // For model messages, prefer the live stream snapshot when streaming so
    // the loader dots and pending-tool detection are accurate token-by-token.
    const stream = useMessageStream(message.author === Author.MODEL ? message.id : undefined);
    const live = stream ?? message;

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
                style={{ boxShadow: SHADOW, alignSelf: 'flex-end', ...glassStyle }}
              >
                <MessageBodyContent message={message} containerWidth={containerWidth} />
              </Box>
            )}
          </Stack>
        </Group>
      );
    } // no thinking or generating for user messages

    return (
      <Box w="100%" ref={containerRef} style={style}>
        <Box display="inline">
          <MessageBodyContent message={message} containerWidth={containerWidth} />
          {live.state.any && (
            <Box
              component="span"
              display="inline-block"
              style={{ verticalAlign: 'middle' }}
              className="shimmer-text active"
              fz="25px"
            >
              &middot;&middot;&middot;
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
