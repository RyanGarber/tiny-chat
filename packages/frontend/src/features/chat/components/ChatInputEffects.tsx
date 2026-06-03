import { ActionIcon, Box, Group } from '@mantine/core';
import { ReactNode, RefObject } from 'react';
import { useLayoutStore } from '@/core/stores/useLayoutStore';
import { Icon } from '@iconify/react';
import { scrubText } from '@/utils/text.ts';
import Attachments from '@/features/input/components/Attachments';
import { useMessagingStore } from '@/features/chat/stores/useMessagingStore';
import { texts } from '@tiny-chat/shared/src/utils.ts';
import { glassStyle } from '@/utils/glass';
import { SHADOW } from '@/utils/theme';

function ChatInputEffect({
  content,
  onDelete,
  isAny,
}: {
  content: ReactNode;
  onDelete: () => void;
  isAny: boolean;
}) {
  return (
    <Group
      className="input-effect"
      bg="transparent"
      align="center"
      gap={5}
      px={10}
      py={5}
      w="fit-content"
      bdrs={25}
      fz={14}
      opacity={isAny ? 0.5 : 1}
      style={{ ...glassStyle, boxShadow: SHADOW, pointerEvents: 'auto' }}
    >
      <ActionIcon size={20} variant="subtle" color="dimmed" onClick={onDelete} disabled={isAny}>
        <Icon icon="lucide:x" height={18} />
      </ActionIcon>
      <Box>{content}</Box>
    </Group>
  );
}

export default function ChatInputEffects({
  inputEffectsRef,
  inputMaxWidth,
  chatContainerHeight,
  isAny,
}: {
  inputEffectsRef: RefObject<HTMLDivElement | null>;
  inputMaxWidth: number;
  chatContainerHeight: number;
  isAny: boolean;
}) {
  const editing = useMessagingStore((s) => s.editing);
  const setEditing = useMessagingStore((s) => s.setEditing);
  const insertingAfter = useMessagingStore((s) => s.insertingAfter);
  const setInsertingAfter = useMessagingStore((s) => s.setInsertingAfter);
  const truncating = useMessagingStore((s) => s.truncating);
  const setTruncating = useMessagingStore((s) => s.setTruncating);
  const uploads = useMessagingStore((s) => s.uploads);
  const removeUpload = useMessagingStore((s) => s.removeUpload);
  const isMobile = useLayoutStore((s) => s.isMobile);
  return (
    <Group
      pos="absolute"
      bottom={0}
      left={isMobile ? 10 : 20}
      right={isMobile ? 10 : 20}
      justify="center"
      style={{
        pointerEvents: 'none',
        zIndex: 'calc(var(--mantine-z-index-app) + 1)',
      }}
    >
      <div style={{ width: '100%', maxWidth: inputMaxWidth - 40 }}>
        <Group gap={3} pb={3} ref={inputEffectsRef}>
          {editing && (
            <ChatInputEffect
              content={
                <>
                  Editing{' '}
                  <span style={{ color: '#aaa' }}>{scrubText(texts(editing.data), 20)}</span>
                </>
              }
              onDelete={() => setEditing(null)}
              isAny={isAny}
            />
          )}
          {truncating && (
            <ChatInputEffect
              content={'Deleting newer'}
              onDelete={() => setTruncating(false)}
              isAny={isAny}
            />
          )}
          {insertingAfter && (
            <ChatInputEffect
              content={
                <>
                  Inserting after{' '}
                  <span style={{ color: '#aaa' }}>{scrubText(texts(insertingAfter.data), 20)}</span>
                </>
              }
              onDelete={() => setInsertingAfter(null)}
              isAny={isAny}
            />
          )}
          {uploads.map((file, i) => (
            <ChatInputEffect
              content={
                <Attachments
                  list={[{ name: file.name, image: file.thumbnail }]}
                  width={inputMaxWidth}
                  maxHeight={chatContainerHeight}
                  size={22}
                />
              }
              onDelete={() => removeUpload(i)}
              key={i}
              isAny={isAny}
            />
          ))}
        </Group>
      </div>
    </Group>
  );
}
