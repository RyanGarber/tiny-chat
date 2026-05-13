import { ActionIcon, Box, Group } from '@mantine/core';
import { ReactNode, RefObject } from 'react';
import { useLayout } from '@/stores/layout.tsx';
import { Icon } from '@iconify/react';
import { extractText, scrubText } from '@/utils/text.ts';
import Attachments from '@/components/Attachments.tsx';
import { useMessaging } from '@/stores/messaging.tsx';

function ChatInputEffect({ content, onDelete }: { content: ReactNode; onDelete: () => void }) {
  const shadow = useLayout((s) => s.shadow);
  const messagingDisables = useLayout((s) => s.messagingDisables);
  return (
    <Group
      className="input-effect"
      align="center"
      gap={5}
      px={10}
      py={5}
      w="fit-content"
      bdrs={10}
      fz={14}
      opacity={messagingDisables.size > 0 ? 0.5 : 1}
      style={{ boxShadow: shadow, pointerEvents: 'auto' }}
    >
      <ActionIcon
        size={20}
        variant="subtle"
        onClick={onDelete}
        disabled={messagingDisables.size > 0}
      >
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
  isInputMaxWidth,
}: {
  inputEffectsRef: RefObject<HTMLDivElement | null>;
  inputMaxWidth: number;
  chatContainerHeight: number;
  isInputMaxWidth: boolean;
}) {
  const editing = useMessaging((s) => s.editing);
  const setEditing = useMessaging((s) => s.setEditing);
  const insertingAfter = useMessaging((s) => s.insertingAfter);
  const setInsertingAfter = useMessaging((s) => s.setInsertingAfter);
  const truncating = useMessaging((s) => s.truncating);
  const setTruncating = useMessaging((s) => s.setTruncating);
  const uploads = useMessaging((s) => s.uploads);
  const removeUpload = useMessaging((s) => s.removeUpload);
  return (
    <Group
      pos="absolute"
      bottom={0}
      left={0}
      right={0}
      justify="center"
      p={isInputMaxWidth ? 0 : '0 10px'}
      style={{
        pointerEvents: 'none',
      }}
    >
      <div style={{ width: '100%', maxWidth: inputMaxWidth }}>
        <Group gap={3} pb={3} ref={inputEffectsRef}>
          {editing && (
            <ChatInputEffect
              content={
                <>
                  Editing{' '}
                  <span style={{ color: '#aaa' }}>{scrubText(extractText(editing.data), 20)}</span>
                </>
              }
              onDelete={() => setEditing(null)}
            />
          )}
          {truncating && (
            <ChatInputEffect content={'Overwriting newer'} onDelete={() => setTruncating(false)} />
          )}
          {insertingAfter && (
            <ChatInputEffect
              content={
                <>
                  Inserting after{' '}
                  <span style={{ color: '#aaa' }}>
                    {scrubText(extractText(insertingAfter.data), 20)}
                  </span>
                </>
              }
              onDelete={() => setInsertingAfter(null)}
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
            />
          ))}
        </Group>
      </div>
    </Group>
  );
}
