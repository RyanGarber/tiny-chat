import { useEffect, useRef, useState } from 'react';
import { useLayout } from '@/stores/layout.tsx';
import { ActionIcon, Button, Menu, Modal, NavLink, NavLinkProps, TextInput, Indicator } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useChats } from '@/stores/chats.tsx';
import { Chat } from '@tiny-chat/core-backend/generated/prisma/client.ts';
import { Icon } from '@iconify/react';

export default function SidebarChat({ chat, props }: { chat: Chat & { updatedAt?: Date }; props: NavLinkProps }) {
  const { currentChat, renameChat, deleteChat, clientLastViewedAt } = useChats();
  const { isMobile, setGestureBlock } = useLayout();

  const [title, setTitle] = useState<string | null>(null);
  const [isEditOpen, { open: openEdit, close: closeEdit }] = useDisclosure(false);
  const [isDeleteOpen, { open: openDelete, close: closeDelete }] = useDisclosure(false);

  useEffect(() => {
    setGestureBlock(isEditOpen);
  }, [isEditOpen, setGestureBlock]);

  const saveTitle = async () => {
    if (!title) return;
    await renameChat(chat.id, title);
    closeEdit();
  };

  const saveDelete = async () => {
    await deleteChat(chat.id);
    closeDelete();
  };

  // TODO use @mantine/modals

  const navLinkRef = useRef<HTMLAnchorElement>(null);
  const [isOpen, setOpen] = useState(false);
  const active = currentChat?.id === chat.id;
  const hasUpdates = chat.updatedAt && chat.updatedAt.getTime() > (clientLastViewedAt[chat.id] ?? 0) && !active;

  return (
    <>
      <NavLink
        key={chat.id}
        label={
          <Indicator inline size={8} disabled={!hasUpdates} offset={-2} color="blue">
            {chat.title ?? 'Generating...'}
          </Indicator>
        }
        variant="filled"
        active={active}
        ref={navLinkRef}
        className={'section-on-hover' + (active || isMobile || isOpen ? ' hover' : '')}
        {...props}
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
                  setTitle(chat.title ?? '');
                  openEdit();
                }}
              >
                Rename
              </Menu.Item>
              <Menu.Item
                leftSection={<Icon icon="lucide:trash" height={18} />}
                onClick={(e) => {
                  e.stopPropagation();
                  openDelete();
                }}
              >
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        }
      />
      <Modal title="Rename Chat" opened={isEditOpen} onClose={closeEdit}>
        <TextInput
          placeholder="Chat Title"
          mb={10}
          value={title ?? ''}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void saveTitle()}
          data-autofocus
        />
        <Button variant="filled" fullWidth onClick={() => void saveTitle()}>
          Save
        </Button>
      </Modal>
      <Modal title="Delete Chat" opened={isDeleteOpen} onClose={closeDelete}>
        <Button color="red" fullWidth onClick={() => void saveDelete()}>
          Confirm
        </Button>
      </Modal>
    </>
  );
}
