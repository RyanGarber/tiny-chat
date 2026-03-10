import { ActionIcon, Box, Group } from '@mantine/core';
import { ReactNode } from 'react';
import { useLayout } from '@/managers/layout.tsx';
import { Icon } from '@iconify/react';

export default function InputEffect({
  content,
  onDelete,
}: {
  content: ReactNode;
  onDelete: () => void;
}) {
  const { shadow, isMessagingDisabled } = useLayout();
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
      opacity={isMessagingDisabled ? 0.5 : 1}
      style={{ boxShadow: shadow, pointerEvents: 'auto' }}
    >
      <ActionIcon size={20} variant="subtle" onClick={onDelete} disabled={isMessagingDisabled}>
        <Icon icon="lucide:x" height={18} />
      </ActionIcon>
      <Box>{content}</Box>
    </Group>
  );
}
