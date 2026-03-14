import { Box, Group, Skeleton, Stack } from '@mantine/core';
import { useElementSize } from '@mantine/hooks';
import { MessageOmitted, texts } from '@tiny-chat/core-backend/src/types';
import MessageBodyContent from '@/components/MessageBodyContent.tsx';
import { useLayout } from '@/managers/layout.tsx';
import Attachments from '@/components/Attachments.tsx';
import { Author } from '@tiny-chat/core-backend/generated/prisma/enums.ts';
import { Icon } from '@iconify/react';
import { CSSProperties } from 'react';

export default function MessageBody({
  message,
  style,
}: {
  message: MessageOmitted;
  style?: CSSProperties;
}) {
  const { shadow } = useLayout();

  const { ref: containerRef, width: containerWidth } = useElementSize();

  if (message.author === Author.USER) {
    const files = message.data.filter((p) => p.type === 'file');
    return (
      <Group w="100%" justify="end" ref={containerRef} style={style}>
        <Stack gap={5} w="fit-content">
          {texts(message.data).trim().length > 0 && (
            <Box px={20} py={10} bdrs="lg" className="user-message" style={{ boxShadow: shadow }}>
              <MessageBodyContent message={message} containerWidth={containerWidth} />
            </Box>
          )}
          {files.length !== 0 && (
            <Group
              gap={5}
              c="dimmed"
              mt={15}
              mb={texts(message.data).trim().length > 0 ? -45 : 0}
              style={{ zIndex: 'var(--mantine-z-index-app' }}
            >
              <Icon icon="lucide:paperclip" height={18} />
              <Attachments
                list={files.map((f) => ({ name: f.name, mime: f.mime, url: f.url }))}
                width={containerWidth}
              />
            </Group>
          )}
        </Stack>
      </Group>
    );
  } // no thinking or generating for user messages

  const hasRenderedParts = message.data.length > 0;
  const showContent = !message.state.any || message.state.generating || hasRenderedParts;

  return (
    <Box
      w="100%"
      ref={containerRef}
      style={{
        ...style,
        ...(message.state.any && !message.state.generating
          ? { display: 'flex', gap: 10, justifyContent: 'center' }
          : {}),
      }}
    >
      {showContent ? (
        <>
          <MessageBodyContent message={message} containerWidth={containerWidth} />
        </>
      ) : (
        <div style={{ flex: 1 }}>
          <Skeleton height={10} radius="md" />
          <Skeleton height={10} width="70%" mt={10} mb={20} radius="md" />
        </div>
      )}
    </Box>
  );
}
