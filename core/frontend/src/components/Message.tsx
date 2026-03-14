import { ActionIcon, Box, Button, Group, Modal, Stack, Text, Tooltip } from '@mantine/core';
import { useClipboard, useDisclosure } from '@mantine/hooks';
import { useMessaging } from '@/managers/messaging.tsx';
import { useChats } from '@/managers/chats.tsx';
import MessageBody from '@/components/MessageBody.tsx';
import { MessageOmitted as MessageData } from '@tiny-chat/core-backend/src/types.ts';
import { extractText } from '@/utils.ts';
import { Author } from '@tiny-chat/core-backend/generated/prisma/enums.ts';
import { JSX } from 'react';
import { Icon } from '@iconify/react';

export default function Message({ message, opacity }: { message: MessageData; opacity: number }) {
  const { currentChat, cloneChat, messages } = useChats();
  const { editing, setEditing, insertingAfter, setInsertingAfter, deleteMessagePair } =
    useMessaging();

  const [isNodeHovered, { open: onNodeHover, close: onNodeLeave }] = useDisclosure(false);
  const [isConfirmingDelete, { open: onConfirmDelete, close: onCancelDelete }] =
    useDisclosure(false);
  const clipboard = useClipboard();

  const actions: JSX.Element[] = [];
  if (messages.length > messages.indexOf(message) + 1) {
    actions.push(
      <Tooltip label="Insert Here" position="bottom" color="gray" key="insert">
        <ActionIcon
          variant="subtle"
          size={32}
          onClick={() => setInsertingAfter(insertingAfter?.id !== message.id ? message : null)}
        >
          {insertingAfter?.id === message.id ? (
            <Icon icon="lucide:x" width={20} />
          ) : (
            <Icon icon="lucide:list-start" width={20} />
          )}
        </ActionIcon>
      </Tooltip>,
    );
  }
  if (!currentChat!.temporary) {
    actions.push(
      <Tooltip label="Fork Here" position="bottom" color="gray" key="clone">
        <ActionIcon variant="subtle" size={32} onClick={() => void cloneChat(message.id)}>
          <Icon icon="lucide:split" width={20} />
        </ActionIcon>
      </Tooltip>,
    );
  }

  const fade = {
    opacity: opacity,
    transition: 'opacity 0.2s',
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: message.author === Author.USER ? 'flex-end' : 'flex-start',
          padding: '10px 0',
        }}
      >
        <Stack align={message.author === Author.USER ? 'end' : 'start'} w="100%">
          <MessageBody message={message} style={fade} />
          <Box w="100%">
            <Group gap={0} justify={message.author === Author.USER ? 'end' : 'space-between'}>
              <Group gap={0} style={fade}>
                {message.author === Author.USER && (
                  <Group c="dimmed" gap={5}>
                    <Icon icon="lucide:send" height={14} />
                    <Text size="xs" m={0}>
                      {message.config.model}
                      <span style={{ padding: '0 5px 0 10px' }}>&middot;</span>
                    </Text>
                  </Group>
                )}
                <Tooltip
                  label={clipboard.copied ? 'Copied' : 'Copy'}
                  position="bottom"
                  color="gray"
                >
                  <ActionIcon
                    variant="subtle"
                    size={30}
                    onClick={() => {
                      clipboard.copy(extractText(message.data));
                    }}
                  >
                    <Icon icon="lucide:copy" height={18} />
                  </ActionIcon>
                </Tooltip>
                {message.author === Author.USER && (
                  <>
                    <Tooltip label="Edit" position="bottom" color="gray">
                      <ActionIcon
                        variant="subtle"
                        size={30}
                        onClick={() => setEditing(editing?.id !== message.id ? message : null)}
                      >
                        {editing?.id !== message.id ? (
                          <Icon icon="lucide:edit" height={18} />
                        ) : (
                          <Icon icon="lucide:x" height={18} />
                        )}
                      </ActionIcon>
                    </Tooltip>
                  </>
                )}
                <Tooltip label="Delete" position="bottom" color="gray">
                  <ActionIcon variant="subtle" size={30} onClick={onConfirmDelete}>
                    <Icon icon="lucide:trash" height={18} />
                  </ActionIcon>
                </Tooltip>
                {message.author === Author.MODEL && (
                  <Text size="xs" c="dimmed">
                    <span style={{ padding: '0 10px 0 5px' }}>&middot;</span>
                    {message.config.model}
                  </Text>
                )}
              </Group>
              {message.author === Author.MODEL && actions.length !== 0 && (
                <Box
                  bg="var(--tc-surface)"
                  bdrs="md"
                  opacity={isNodeHovered || insertingAfter?.id === message.id ? 1 : 0.5}
                  onMouseEnter={onNodeHover}
                  onMouseLeave={onNodeLeave}
                  style={{ transition: 'opacity 0.2s' }}
                >
                  {actions}
                </Box>
              )}
            </Group>
          </Box>
        </Stack>
      </div>
      <Modal opened={isConfirmingDelete} onClose={onCancelDelete} title="Delete Message">
        <Button
          color="red"
          fullWidth
          onClick={() => {
            void deleteMessagePair(message.id);
            onCancelDelete();
          }}
        >
          Confirm
        </Button>
      </Modal>
    </div>
  );
}
