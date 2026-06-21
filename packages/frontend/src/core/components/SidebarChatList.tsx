import {
  ActionIcon,
  Button,
  Indicator,
  Menu,
  Modal,
  NavLink,
  ScrollArea,
  Stack,
  TextInput,
} from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';
import { useLayoutStore } from '@/core/stores/useLayoutStore';
import { Icon } from '@iconify/react';
import { useDisclosure } from '@mantine/hooks';
import { type ChatState, useChat } from '@/features/chat/hooks/useChat';
import { useChatList } from '@/features/chat/hooks/useChatList';
import { useSentinel } from '../hooks/useSentinel';
import { ChatService } from '@/features/chat/services/ChatService';
import { GLASS_STYLE, SHADOW } from '@/utils/theme.ts';
import { query } from '@/utils/api.ts';
import Sentinel from './Sentinel';

export default function SidebarChatList() {
  const isMobile = useLayoutStore((s) => s.isMobile);
  const setSidebarOpen = useLayoutStore((s) => s.setSidebarOpen);
  const setGestureBlock = useLayoutStore((s) => s.setGestureBlock);

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

  const { folders, renameChat, deleteChat } = useChatList();
  const { chat } = useChat();

  const { viewportRef, sentinelRef } = useSentinel({
    query: folders,
    queryKey: query.chat.list.pathKey(),
  });

  return (
    <>
      <ScrollArea flex={1} viewportRef={viewportRef}>
        <Stack gap={10}>
          {folders.data?.pages
            .flatMap((page) => page.folders)
            .map((folder) => {
              const chats = folder.chats.map((c) => (
                <ChatListItem
                  key={c.id}
                  chat={c}
                  active={chat.data?.id === c.id}
                  onClick={() => closeAfter(() => ChatService.setChatId(c.id))}
                  onRename={() => {
                    setEditingChat(c);
                    setTitle(c.title ?? '');
                    openEdit();
                  }}
                  onDelete={() => {
                    setDeletingChat(c);
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
        <Sentinel isFetching={folders.isFetching} ref={sentinelRef} />
      </ScrollArea>

      <Modal
        title="Rename Chat"
        opened={isEditOpen}
        onClose={closeEdit}
        styles={{ content: GLASS_STYLE }}
        centered
      >
        <TextInput
          placeholder="Chat Title"
          mb={10}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) =>
            e.key === 'Enter' &&
            renameChat.mutate({ chat: editingChat!, title }, { onSuccess: () => closeEdit() })
          }
          data-autofocus
        />
        <Button
          variant="filled"
          fullWidth
          onClick={() =>
            renameChat.mutate({ chat: editingChat!, title }, { onSuccess: () => closeEdit() })
          }
          loading={renameChat.isPending}
          disabled={renameChat.isPending || !title}
        >
          Save
        </Button>
      </Modal>

      <Modal
        title="Delete Chat"
        opened={isDeleteOpen}
        onClose={closeDelete}
        styles={{ content: GLASS_STYLE }}
        centered
      >
        <Button
          color="red"
          fullWidth
          onClick={() =>
            deleteChat.mutate({ chat: deletingChat! }, { onSuccess: () => closeDelete() })
          }
          loading={deleteChat.isPending}
          disabled={deleteChat.isPending}
        >
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
  const isMobile = useLayoutStore((s) => s.isMobile);
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
        h={40}
        {...(chat.unseen && { pl: 35 })}
        rightSection={
          <Menu width={200} onChange={setOpen} styles={{ dropdown: { boxShadow: SHADOW } }}>
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
