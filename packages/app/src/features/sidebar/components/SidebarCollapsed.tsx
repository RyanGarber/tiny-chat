import { Icon } from "@iconify/react";
import { ActionIcon, Avatar, Burger, Stack, Tooltip } from "@mantine/core";
import type { useSession } from "@tiny-chat/client/src/core/hooks/useSession.ts";
import type { useChat } from "@tiny-chat/client/src/features/chat/hooks/useChat.ts";
import { ChatService } from "@tiny-chat/client/src/features/chat/services/ChatService.ts";
import { useChatStore } from "@tiny-chat/client/src/features/chat/stores/useChatStore.ts";
import { useAppStore } from "#app/core/stores/useAppStore.ts";

export default function SidebarCollapsed({
	chat,
	session,
	isTemporary,
	isIncognito,
	close,
}: {
	chat: ReturnType<typeof useChat>["chat"];
	session: ReturnType<typeof useSession>["session"];
	isTemporary: boolean;
	isIncognito: boolean;
	close: (fn: () => void) => void;
}) {
	const isSidebarOpen = useAppStore((state) => state.isSidebarOpen);
	const setSidebarOpen = useAppStore((state) => state.setSidebarOpen);
	const setCurrentDrawer = useAppStore((state) => state.setCurrentDrawer);

	const setCreateTemporary = useChatStore((state) => state.setCreateTemporary);
	const setCreateIncognito = useChatStore((state) => state.setCreateIncognito);

	return (
		<Stack align="center" justify="space-between" h="100%" py="xs">
			<Stack align="center" gap="sm">
				<Burger
					opened={isSidebarOpen}
					onClick={() => setSidebarOpen(!isSidebarOpen)}
					size={16}
				/>
				<Tooltip label="New Chat" position="right" color="gray">
					<ActionIcon
						size={32}
						variant="subtle"
						c="dimmed"
						className="nav-link-like filled"
						data-active={!chat.data}
						onClick={() => close(() => ChatService.setChat({ id: null }))}
					>
						<Icon icon="lucide:message-circle-plus" height={18} />
					</ActionIcon>
				</Tooltip>
				<Tooltip label="Temporary" color="gray" position="right">
					<ActionIcon
						size={32}
						variant="subtle"
						c={!isTemporary ? "dimmed" : undefined}
						className="nav-link-like"
						data-active={isTemporary}
						onClick={() =>
							close(() => {
								if (chat.data) ChatService.setChat({ id: null });
								setCreateTemporary(!isTemporary);
							})
						}
					>
						<Icon icon="lucide:eye-off" height={18} />
					</ActionIcon>
				</Tooltip>
				<Tooltip label="Anonymous" color="gray" position="right">
					<ActionIcon
						size={32}
						variant="subtle"
						c={!isIncognito ? "dimmed" : undefined}
						className="nav-link-like"
						data-active={isIncognito}
						onClick={() =>
							close(() => {
								if (chat.data) ChatService.setChat({ id: null });
								setCreateIncognito(!isIncognito);
							})
						}
					>
						<Icon icon="lucide:ghost" height={18} />
					</ActionIcon>
				</Tooltip>
			</Stack>
			<Stack align="center" gap="sm">
				<Tooltip
					label={
						!session?.data?.user || session.data.user.isAnonymous
							? "Sign In"
							: session.data.user.name.split(" ")[0]
					}
					position="right"
					color="gray"
				>
					<ActionIcon
						size={32}
						variant="subtle"
						c="dimmed"
						className="nav-link-like"
						onClick={() => setCurrentDrawer("account")}
					>
						{session?.data?.user?.image ? (
							<Avatar src={session.data.user.image} size={18} />
						) : (
							<Icon icon="lucide:user-x" height={18} />
						)}
					</ActionIcon>
				</Tooltip>
				<Tooltip label="Settings" position="right" color="gray">
					<ActionIcon
						variant="subtle"
						size={32}
						c="dimmed"
						className="nav-link-like"
						onClick={() => setCurrentDrawer("settings")}
					>
						<Icon icon="lucide:settings" height={18} />
					</ActionIcon>
				</Tooltip>
			</Stack>
		</Stack>
	);
}
