import { useEffect, useRef, useState } from 'react';
import { useLayout } from '@/stores/layout.tsx';
import {
  ActionIcon,
  Button,
  Menu,
  Modal,
  NavLink,
  NavLinkProps,
  TextInput,
  Indicator,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useChats } from '@/stores/chats.tsx';
import { Chat } from '@tiny-chat/core-backend/generated/prisma/client.ts';
import { Icon } from '@iconify/react';

export default function SidebarChat({
  chat,
  props,
}: {
  chat: Chat & { updatedAt?: Date };
  props: NavLinkProps;
}) {
  const currentChat = useChats((s) => s.currentChat);
  const renameChat = useChats((s) => s.renameChat);
  const deleteChat = useChats((s) => s.deleteChat);
  const updatedChats = useChats((s) => s.updatedChats);

  const isMobile = useLayout((s) => s.isMobile);
  const setGestureBlock = useLayout((s) => s.setGestureBlock);

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

  const navLinkRef = useRef<HTMLAnchorElement>(null);
  const [isOpen, setOpen] = useState(false);
  const active = currentChat?.id === chat.id;

  return (
    <>
      <Indicator
        size={8}
        disabled={!updatedChats.includes(chat.id)}
        color={active ? 'white' : 'blue'}
        position="middle-start"
        offset={20}
      >
        <NavLink
          key={chat.id}
          label={chat.title ?? 'Sending...'}
          variant="filled"
          active={active}
          ref={navLinkRef}
          className={'section-on-hover' + (active || isMobile || isOpen ? ' hover' : '')}
          {...props}
          {...(updatedChats.includes(chat.id) && { pl: 35 })}
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
      </Indicator>
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
