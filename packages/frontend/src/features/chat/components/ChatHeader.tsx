import { ActionIcon, Burger, Group, Tooltip } from '@mantine/core';
import { Icon } from '@iconify/react';
import { useLayout } from '@/stores/layout.tsx';
import { useChat } from '../hooks/useChat';
import { glassStyle } from '@/utils/glass';
import { useChatStore } from '../stores/useChatStore';
import { ChatService } from '../services/ChatService';

export default function ChatHeader({ fixed }: { fixed: boolean }) {
  const activeChat = useChat();
  const isMobile = useLayout((s) => s.isMobile);
  const shadow = useLayout((s) => s.shadow);
  const isSidebarOpen = useLayout((s) => s.isSidebarOpen);
  const setSidebarOpen = useLayout((s) => s.setSidebarOpen);
  const temporary = useChatStore((s) => s.createTemporary);
  const setTemporary = useChatStore((s) => s.setCreateTemporary);
  const incognito = useChatStore((s) => s.createIncognito);
  const setIncognito = useChatStore((s) => s.setCreateIncognito);

  const isTemporary = activeChat.data?.temporary ?? temporary;
  const isIncognito = activeChat.data?.incognito ?? incognito;

  return (
    <Group
      pos={fixed ? 'fixed' : 'sticky'}
      top={0}
      left={0}
      right={0}
      bottom={fixed ? undefined : 0}
      p={10}
      gap={5}
      bdrs="md"
      display={isMobile ? undefined : 'none'}
      style={{
        zIndex: 'calc(var(--mantine-z-index-app) + 1)',
        ...glassStyle,
        boxShadow: shadow,
      }}
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
              onClick={() => ChatService.setChatId(null)}
              data-active={!activeChat.data}
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
              onClick={() => {
                if (activeChat.data) ChatService.setChatId(null);
                setTemporary(!isTemporary);
              }}
              data-active={isTemporary}
            >
              <Icon icon="lucide:eye-off" height={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Anonymous" position="bottom" color="gray">
            <ActionIcon
              size={32}
              variant="subtle"
              c="dimmed"
              bdrs="md"
              className="nav-link-like filled"
              onClick={() => {
                if (activeChat.data) ChatService.setChatId(null);
                setIncognito(!isIncognito);
              }}
              data-active={isIncognito}
            >
              <Icon icon="lucide:ghost" height={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Group>
  );
}
