import {
	ActionIcon,
	Avatar,
	Burger,
	Group,
	NavLink,
	Text,
	Tooltip,
} from "@mantine/core";
import { spotlight } from "@mantine/spotlight";
import {
	EyeSlashIcon,
	GearIcon,
	GhostIcon,
	MagnifyingGlassIcon,
	PlusCircleIcon,
	UserCircleIcon,
} from "@phosphor-icons/react";
import type { useSession } from "@tiny-chat/client/src/core/hooks/useSession.ts";
import type { useChat } from "@tiny-chat/client/src/features/chat/hooks/useChat.ts";
import { ChatService } from "@tiny-chat/client/src/features/chat/services/ChatService.ts";
import { useChatStore } from "@tiny-chat/client/src/features/chat/stores/useChatStore.ts";
import { useMessagingStore } from "@tiny-chat/client/src/features/chat/stores/useMessagingStore.ts";
import { useAppStore } from "#app/core/stores/useAppStore.ts";
import SidebarChatList from "#app/features/sidebar/components/SidebarChatList.tsx";
import { version } from "../../../../../../apps/tauri/tauri.conf.json";

export default function SidebarExpanded({
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
	const activeFolder = useMessagingStore((state) => state.activeFolder);

	return (
		<>
			<Group justify="space-between" p="xs" wrap="nowrap">
				<ActionIcon variant="transparent" onClick={spotlight.open}>
					<MagnifyingGlassIcon size={20} color="var(--mantine-color-text)" />
				</ActionIcon>
				<Burger
					opened={isSidebarOpen}
					onClick={() => setSidebarOpen(!isSidebarOpen)}
					size={16}
				/>
			</Group>
			<Group align="center" my="md" gap={3} wrap="nowrap">
				<NavLink
					label="New Chat"
					variant="filled"
					c="dimmed"
					className="nav-link-like filled"
					leftSection={<PlusCircleIcon size={20} />}
					onClick={() => close(() => ChatService.newChat())}
					active={!chat.data && !activeFolder}
					flex={1}
					h={40}
				/>
				<Tooltip label="Temporary" color="gray" position="right">
					<ActionIcon
						size={40}
						variant="subtle"
						c={!isTemporary ? "dimmed" : undefined}
						className="nav-link-like"
						onClick={() =>
							close(() => {
								if (chat.data) ChatService.newChat();
								setCreateTemporary(!isTemporary);
							})
						}
						data-active={isTemporary}
					>
						<EyeSlashIcon size={20} />
					</ActionIcon>
				</Tooltip>
				<Tooltip label="Anonymous" color="gray" position="right">
					<ActionIcon
						size={40}
						variant="subtle"
						c={!isIncognito ? "dimmed" : undefined}
						className="nav-link-like"
						onClick={() =>
							close(() => {
								if (chat.data) ChatService.newChat();
								setCreateIncognito(!isIncognito);
							})
						}
						data-active={isIncognito}
					>
						<GhostIcon size={20} />
					</ActionIcon>
				</Tooltip>
			</Group>
			<SidebarChatList />
			<NavLink
				mt="lg"
				c="dimmed"
				label={
					!session?.data?.user || session.data.user.isAnonymous
						? "Sign In"
						: session.data.user.name.split(" ")[0]
				}
				leftSection={
					session?.data?.user?.image ? (
						<Avatar src={session.data.user.image} size={18} />
					) : (
						<UserCircleIcon size={20} />
					)
				}
				onClick={() => setCurrentDrawer("account")}
				h={40}
				mb={5}
			/>
			<NavLink
				c="dimmed"
				label={
					<Group justify="space-between" wrap="nowrap">
						Settings
						<Text size="sm" c="dimmed" pr={5}>
							{version}
						</Text>
					</Group>
				}
				leftSection={<GearIcon size={20} />}
				onClick={() => setCurrentDrawer("settings")}
				h={40}
				mb={5}
			/>
		</>
	);
}
