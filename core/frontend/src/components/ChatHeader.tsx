import { ActionIcon, Burger, Group, Tooltip } from '@mantine/core';
import { Icon } from '@iconify/react';
import { useChats } from '@/stores/chats.tsx';
import { useLayout } from '@/stores/layout.tsx';

export default function ChatHeader({ fixed }: { fixed: boolean }) {
  const currentChat = useChats((s) => s.currentChat);
  const setCurrentChat = useChats((s) => s.setCurrentChat);
  const isMobile = useLayout((s) => s.isMobile);
  const shadow = useLayout((s) => s.shadow);
  const isSidebarOpen = useLayout((s) => s.isSidebarOpen);
  const setSidebarOpen = useLayout((s) => s.setSidebarOpen);
  const isTemporary = useChats((s) => s.temporary);
  const setTemporary = useChats((s) => s.setTemporary);
  const isIncognito = useChats((s) => s.incognito);
  const setIncognito = useChats((s) => s.setIncognito);

  return (
    <Group
      pos={fixed ? 'fixed' : 'sticky'}
      top={0}
      left={0}
      right={0}
      bottom={fixed ? undefined : 0}
      p={10}
      gap={5}
      display={isMobile ? undefined : 'none'}
      style={{
        zIndex: 'calc(var(--mantine-z-index-app) + 1)',
        backgroundColor: 'color-mix(in srgb, var(--mantine-color-body), transparent 15%)',
        backdropFilter: 'blur(5px)',
        boxShadow: shadow,
        borderBottom: '1px solid var(--mantine-color-default-border)',
      }}
      className="topbar"
    >
      <Burger
        opened={isSidebarOpen}
        onClick={() => setSidebarOpen(!isSidebarOpen)}
        display={!isMobile || isSidebarOpen ? 'none' : undefined}
        size="sm"
      />
      <Group justify="space-between" flex={1}>
        <Group gap={4}>
          <Tooltip label="New Chat" position="bottom" color="gray">
            <ActionIcon
              size={32}
              variant="subtle"
              c="dimmed"
              bdrs="md"
              className="nav-link-like filled"
              onClick={() => void setCurrentChat(null)}
              data-active={!currentChat}
            >
              <Icon icon="lucide:message-circle-plus" height={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Group gap={4}>
          <Tooltip label="Temporary" position="bottom" color="gray">
            <ActionIcon
              size={32}
              variant="subtle"
              c="dimmed"
              bdrs="md"
              className="nav-link-like filled"
              onClick={() => void setTemporary(!isTemporary)}
              data-active={isTemporary}
            >
              <Icon icon="lucide:list-x" height={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Anonymous" position="bottom" color="gray">
            <ActionIcon
              size={32}
              variant="subtle"
              c="dimmed"
              bdrs="md"
              className="nav-link-like filled"
              onClick={() => void setIncognito(!isIncognito)}
              data-active={isIncognito}
            >
              <Icon icon="lucide:user-x" height={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Group>
  );
}
