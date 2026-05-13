import {
  ActionIcon,
  Button,
  Indicator,
  Menu,
  Modal,
  NavLink,
  ScrollArea,
  Skeleton,
  Stack,
  TextInput,
} from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';
import { useLayout } from '@/stores/layout';
import { Icon } from '@iconify/react';
import { useDisclosure } from '@mantine/hooks';
import { useChat, type ChatState } from '@/features/chat/hooks/useChat';
import { useChatList } from '@/features/chat/hooks/useChatList';
import { glassStyle } from '@/utils/glass';
import { useSentinel } from '../hooks/useSentinel';
import { ChatService } from '@/features/chat/services/ChatService';
import { query } from '@/utils/api';

export default function SidebarChatList() {
  const isMobile = useLayout((s) => s.isMobile);
  const setSidebarOpen = useLayout((s) => s.setSidebarOpen);
  const setGestureBlock = useLayout((s) => s.setGestureBlock);

  const [title, setTitle] = useState<string>('');
  const [editingChat, setEditingChat] = useState<ChatState | null>(null);
  const [deletingChat, setDeletingChat] = useState<ChatState | null>(null);

  const [isEditOpen, { open: openEdit, close: closeEdit }] = useDisclosure(false);
  const [isDeleteOpen, { open: openDelete, close: closeDelete }] = useDisclosure(false);

  const closeAfter = useCallback(
    (action?: () => void) => {
      action?.();
      if (isMobile) setSidebarOpen(false);
    },
    [isMobile, setSidebarOpen],
  );

  useEffect(() => {
    setGestureBlock(isEditOpen);
  }, [isEditOpen, setGestureBlock]);

  const chatList = useChatList();
  const activeChat = useChat();

  const saveTitle = async () => {
    if (!editingChat || !title) return;
    await ChatService.renameChat(editingChat, title);
    closeEdit();
  };

  const saveDelete = async () => {
    if (!deletingChat) return;
    await ChatService.deleteChat(deletingChat, activeChat.data ?? null);
    closeDelete();
  };

  const { viewportRef, sentinelRef } = useSentinel({
    query: chatList,
    queryKey: query.folders.list.pathKey(),
  });

  return (
    <>
      <ScrollArea flex={1} viewportRef={viewportRef}>
        <Stack gap={5}>
          {chatList.data?.pages
            .flatMap((page) => page.folders)
            .map((folder) => {
              const chats = folder.chats.map((chat) => (
                <ChatListItem
                  key={chat.id}
                  chat={chat}
                  active={activeChat.data?.id === chat.id}
                  onClick={() => closeAfter(() => ChatService.setChatId(chat.id))}
                  onRename={() => {
                    setEditingChat(chat);
                    setTitle(chat.title ?? '');
                    openEdit();
                  }}
                  onDelete={() => {
                    setDeletingChat(chat);
                    openDelete();
                  }}
                />
              ));

              if (chats.length === 1) {
                return chats[0];
              } else {
                return (
                  <NavLink
                    key={folder.id}
                    label={folder.title}
                    leftSection={folder.chats.length}
                    defaultOpened={true}
                  >
                    {chats}
                  </NavLink>
                );
              }
            })}
        </Stack>
        <Skeleton
          key="loading"
          height={10}
          opacity={chatList.isFetching ? 1 : 0.25}
          animate={chatList.isFetching}
          ref={sentinelRef}
        />
      </ScrollArea>

      <Modal
        title="Rename Chat"
        opened={isEditOpen}
        onClose={closeEdit}
        styles={{ content: glassStyle }}
        centered
      >
        <TextInput
          placeholder="Chat Title"
          mb={10}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void saveTitle()}
          data-autofocus
        />
        <Button variant="filled" fullWidth onClick={() => void saveTitle()}>
          Save
        </Button>
      </Modal>

      <Modal
        title="Delete Chat"
        opened={isDeleteOpen}
        onClose={closeDelete}
        styles={{ content: glassStyle }}
        centered
      >
        <Button color="red" fullWidth onClick={() => void saveDelete()}>
          Confirm
        </Button>
      </Modal>
    </>
  );
}

function ChatListItem({
  chat,
  active,
  onClick,
  onRename,
  onDelete,
}: {
  chat: ChatState;
  active: boolean;
  onClick: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const isMobile = useLayout((s) => s.isMobile);
  const [isOpen, setOpen] = useState(false);

  return (
    <Indicator
      size={8}
      disabled={!chat.unseen}
      color={active ? 'white' : 'blue'}
      position="middle-start"
      offset={20}
    >
      <NavLink
        key={chat.id}
        label={chat.title ?? 'Sending...'}
        variant="filled"
        active={active}
        className={'section-on-hover' + (active || isMobile || isOpen ? ' hover' : '')}
        onClick={onClick}
        bdrs="md"
        {...(chat.unseen && { pl: 35 })}
        rightSection={
          <Menu shadow="md" width={200} onChange={setOpen}>
            <Menu.Target>
              <ActionIcon
                size={24}
                radius="xl"
                variant={active ? 'white' : isOpen ? 'filled' : 'light'}
                onClick={(e) => e.stopPropagation()}
              >
                <Icon icon="lucide:ellipsis" height={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<Icon icon="lucide:folder-pen" height={18} />}
                onClick={(e) => {
                  e.stopPropagation();
                  onRename();
                }}
              >
                Rename
              </Menu.Item>
              <Menu.Item
                leftSection={<Icon icon="lucide:trash" height={18} />}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        }
      />
    </Indicator>
  );
}
