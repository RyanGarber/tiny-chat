import { Icon } from "@iconify/react";
import { ActionIcon, Burger, Group, Tooltip } from "@mantine/core";
import { useChat } from "@tiny-chat/client/src/features/chat/hooks/useChat.ts";
import { ChatService } from "@tiny-chat/client/src/features/chat/services/ChatService.ts";
import { useChatStore } from "@tiny-chat/client/src/features/chat/stores/useChatStore.ts";
import { useLayoutStore } from "#app/core/stores/useLayoutStore.tsx";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";

export default function ChatHeader({ fixed }: { fixed: boolean }) {
	const { chat } = useChat();
	const isMobile = useLayoutStore((s) => s.isMobile);
	const isSidebarOpen = useLayoutStore((s) => s.isSidebarOpen);
	const setSidebarOpen = useLayoutStore((s) => s.setSidebarOpen);
	const temporary = useChatStore((s) => s.createTemporary);
	const setTemporary = useChatStore((s) => s.setCreateTemporary);
	const incognito = useChatStore((s) => s.createIncognito);
	const setIncognito = useChatStore((s) => s.setCreateIncognito);

	const isTemporary = chat.data?.temporary ?? temporary;
	const isIncognito = chat.data?.incognito ?? incognito;

	return (
		<Group
			pos={fixed ? "fixed" : "sticky"}
			top={0}
			left={0}
			right={0}
			bottom={fixed ? undefined : 0}
			p={10}
			gap={5}
			display={isMobile ? undefined : "none"}
			style={{
				zIndex: "calc(var(--mantine-z-index-app) + 1)",
				...StyleUtils.glass,
				borderTop: "none",
				borderLeft: "none",
				borderRight: "none",
				boxShadow: StyleUtils.shadow,
			}}
		>
			<Burger
				opened={isSidebarOpen}
				onClick={() => setSidebarOpen(!isSidebarOpen)}
				display={!isMobile || isSidebarOpen ? "none" : undefined}
				size="sm"
			/>
			<Group justify="space-between" flex={1}>
				<Group gap={4}>
					<Tooltip label="New Chat" position="bottom" color="gray">
						<ActionIcon
							size={32}
							variant="subtle"
							className="nav-link-like filled"
							onClick={() => ChatService.setChat({ id: null })}
							data-active={!chat.data}
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
							className="nav-link-like"
							onClick={() => {
								if (chat.data) ChatService.setChat({ id: null });
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
							className="nav-link-like"
							onClick={() => {
								if (chat.data) ChatService.setChat({ id: null });
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
