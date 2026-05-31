import { ActionIcon, Box, Button, Group, Modal, Stack, Text, Tooltip } from '@mantine/core';
import { useClipboard, useDisclosure, useHotkeys } from '@mantine/hooks';
import { useMessagingStore } from '@/features/chat/stores/useMessagingStore';
import MessageBody from '@/features/message/components/MessageBody';
import { MessageState } from '@tiny-chat/shared/src/types/chat.ts';
import { texts } from '@tiny-chat/shared/src/utils.ts';
import { Author } from '@tiny-chat/backend/generated/prisma/enums.ts';
import { JSX, memo } from 'react';
import { Icon } from '@iconify/react';
import { useChat } from '@/features/chat/hooks/useChat';
import { glassStyle } from '@/utils/glass';
import Attachments from '@/features/input/components/Attachments';
import { GenerateService } from '../services/GenerateService';
import { useProviders } from '@/features/input/hooks/useProviders';
import { useSkills } from '@/features/input/hooks/useSkills';
import { useTools } from '@/features/input/hooks/useTools';
import { useMessages } from '../hooks/useMessages';
import { useSend } from '@/features/chat/hooks/useMessaging';

const Message = memo(
  function Message({
    message,
    opacity,
    isLast,
  }: {
    message: MessageState;
    opacity: number;
    isLast: boolean;
  }) {
    const { chat, forkChat } = useChat();
    const messages = useMessages();
    const { deleteMessage } = useSend();

    const { providers } = useProviders();
    const { toolGroups } = useTools();
    const { skills } = useSkills();

    const editing = useMessagingStore((s) => s.editing);
    const setEditing = useMessagingStore((s) => s.setEditing);
    const insertingAfter = useMessagingStore((s) => s.insertingAfter);
    const setInsertingAfter = useMessagingStore((s) => s.setInsertingAfter);

    const [isNodeHovered, { open: onNodeHover, close: onNodeLeave }] = useDisclosure(false);
    const [isConfirmingDelete, { open: onConfirmDelete, close: onCancelDelete }] =
      useDisclosure(false);
    const clipboard = useClipboard();

    const uploads = message.data.flat().filter((p) => p.type === 'upload');

    const actions: JSX.Element[] = [];
    if (!isLast) {
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
    if (!chat.data?.temporary) {
      actions.push(
        <Tooltip label="Fork Here" position="bottom" color="gray" key="clone">
          <ActionIcon
            variant="subtle"
            size={32}
            onClick={() => forkChat.mutate({ chat: chat.data!, atMessage: message })}
            loading={forkChat.isPending}
            disabled={forkChat.isPending}
          >
            <Icon icon="lucide:split" width={20} />
          </ActionIcon>
        </Tooltip>,
      );
    }

    const fade = {
      opacity: opacity,
      transition: 'opacity 0.2s',
    };

    useHotkeys([
      [
        'mod+.',
        () => {
          if (message.id === messages.data?.pages.flatMap((page) => page.messages).at(-1)?.id) {
            void GenerateService.handle({
              message,
              activeChat: chat.data!,
              append: [],
              tools: toolGroups,
              skills,
              providers: providers.data!,
            });
          }
        },
      ],
    ]);

    return (
      <div data-message-id={message.id}>
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
                <Group gap={0} style={{ ...fade }}>
                  {uploads.length !== 0 && (
                    <Group gap={5} mr={10} style={{ ...fade }}>
                      <Icon
                        icon="lucide:paperclip"
                        height={14}
                        color="var(--mantine-color-dimmed)"
                      />
                      <Attachments
                        list={uploads.map((u) => ({ name: u.name, image: u.thumbnail }))}
                        size={22}
                      />
                    </Group>
                  )}
                  {message.author === Author.USER && (
                    <Group c="dimmed" gap={5}>
                      <Icon icon="lucide:send" height={14} />
                      <Text
                        size="xs"
                        m={0}
                        style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '33vw',
                        }}
                      >
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
                        clipboard.copy(texts(message.data, '\n'));
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
                    <Text
                      size="xs"
                      c="dimmed"
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '33vw',
                      }}
                    >
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
        <Modal
          opened={isConfirmingDelete}
          onClose={onCancelDelete}
          title="Delete Message"
          styles={{ content: glassStyle }}
          centered
        >
          <Button
            color="red"
            fullWidth
            onClick={() => {
              deleteMessage.mutate(message, { onSuccess: () => onCancelDelete() });
            }}
            loading={deleteMessage.isPending}
            disabled={deleteMessage.isPending}
          >
            Confirm
          </Button>
        </Modal>
      </div>
    );
  },
  (prev, next) =>
    prev.opacity === next.opacity &&
    prev.message.id === next.message.id &&
    prev.message.data === next.message.data &&
    prev.message.state === next.message.state,
);

export default Message;
