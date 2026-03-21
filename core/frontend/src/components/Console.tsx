import { ScrollArea, Text, Stack, Modal, ModalProps, Group, ActionIcon } from '@mantine/core';
import { useLogs } from '../stores/logs.tsx';
import { Icon } from '@iconify/react';
import { Level } from '@tiny-chat/core-backend/src/utils/logs.ts';
import { JsonTree } from '@gfazioli/mantine-json-tree';

export default function Console({ opened, onClose }: Pick<ModalProps, 'opened' | 'onClose'>) {
  const { logs, clearLogs } = useLogs();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap={5}>
          Console{' '}
          <ActionIcon variant="transparent" c="dimmed" onClick={clearLogs}>
            <Icon icon="lucide:eraser" />
          </ActionIcon>
        </Group>
      }
      zIndex="calc(var(--mantine-z-index-modal) + 1)"
      size="lg"
    >
      <Stack>
        <ScrollArea h={400} offsetScrollbars>
          <Stack gap={5}>
            {logs.map((log, i) => (
              <Group
                key={i}
                gap={5}
                align="flex-start"
                justify="space-between"
                bg="var(--mantine-color-default)"
                bdrs="md"
                p="5px 10px 4px"
              >
                <Icon icon="lucide:dot" color="gray" style={{ margin: '0 -2.5px 0 -5px' }} />
                <Group
                  align="flex-start"
                  flex={1}
                  c={
                    log.level === Level.error ? 'red' : log.level === Level.warn ? 'yellow' : 'gray'
                  }
                >
                  {log.data.map((d, j) =>
                    typeof d === 'object' ? (
                      <JsonTree data={d} key={j} />
                    ) : (
                      <Text size="xs" key={j}>
                        {/* eslint-disable-next-line @typescript-eslint/no-base-to-string */}
                        {String(d)}
                      </Text>
                    ),
                  )}
                </Group>
                <Text size="xs" c="dimmed">
                  {log.time}
                </Text>
              </Group>
            ))}
          </Stack>
        </ScrollArea>
      </Stack>
    </Modal>
  );
}
