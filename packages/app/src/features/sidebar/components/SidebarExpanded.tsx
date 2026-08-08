import { Icon } from "@iconify/react";
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
import type { useSession } from "@tiny-chat/client/src/core/hooks/useSession.ts";
import type { useChat } from "@tiny-chat/client/src/features/chat/hooks/useChat.ts";
import { ChatService } from "@tiny-chat/client/src/features/chat/services/ChatService.ts";
import { useChatStore } from "@tiny-chat/client/src/features/chat/stores/useChatStore.ts";
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

	return (
		<>
			<Group justify="space-between" p="xs">
				<ActionIcon variant="transparent" onClick={spotlight.open}>
					<Icon
						icon="lucide:search"
						height={18}
						color="var(--mantine-color-text)"
					/>
				</ActionIcon>
				<Burger
					opened={isSidebarOpen}
					onClick={() => setSidebarOpen(!isSidebarOpen)}
					size={16}
				/>
			</Group>
			<Group align="center" my="md" gap={3}>
				<NavLink
					label="New Chat"
					variant="filled"
					c="dimmed"
					className="nav-link-like filled"
					leftSection={<Icon icon="lucide:message-circle-plus" height={18} />}
					onClick={() => close(() => ChatService.setChat({ id: null }))}
					active={!chat.data}
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
								if (chat.data) ChatService.setChat({ id: null });
								setCreateTemporary(!isTemporary);
							})
						}
						data-active={isTemporary}
					>
						<Icon icon="lucide:eye-off" height={18} />
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
								if (chat.data) ChatService.setChat({ id: null });
								setCreateIncognito(!isIncognito);
							})
						}
						data-active={isIncognito}
					>
						<Icon icon="lucide:ghost" height={18} />
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
						<Icon icon="lucide:circle-user" height={18} />
					)
				}
				onClick={() => setCurrentDrawer("account")}
				h={40}
				mb={5}
			/>
			<NavLink
				c="dimmed"
				label={
					<Group justify="space-between">
						Settings
						<Text size="sm" c="dimmed" pr={5}>
							{version}
						</Text>
					</Group>
				}
				leftSection={<Icon icon="lucide:settings" height={18} />}
				onClick={() => setCurrentDrawer("settings")}
				h={40}
				mb={5}
			/>
		</>
	);
}
