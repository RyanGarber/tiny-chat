import { ActionIcon, Drawer, Group, Tabs } from "@mantine/core";
import {
	ChatCircleIcon,
	KeyIcon,
	SlidersHorizontalIcon,
	TerminalWindowIcon,
} from "@phosphor-icons/react";
import type { EmbeddingStatus } from "@tiny-chat/client/src/features/user/hooks/useEmbedding.ts";
import { useAppStore } from "#app/core/stores/useAppStore.ts";
import AppSettings from "#app/features/sidebar/components/AppSettings.tsx";
import ChatSettings from "#app/features/sidebar/components/ChatSettings.tsx";
import KeysSettings from "#app/features/sidebar/components/KeysSettings.tsx";

export default function SettingsDrawer({
	opened,
	onClose,
	embeddingStatus,
}: {
	opened: boolean;
	onClose: () => void;
	embeddingStatus: EmbeddingStatus;
}) {
	const setCurrentModal = useAppStore((state) => state.setCurrentModal);

	return (
		<Drawer
			opened={opened}
			onClose={onClose}
			title={
				<Group gap={5}>
					Settings{" "}
					<ActionIcon
						variant="transparent"
						c="dimmed"
						onClick={() => setCurrentModal("console")}
					>
						<TerminalWindowIcon size={20} />
					</ActionIcon>
				</Group>
			}
		>
			<Tabs defaultValue="app" variant="pills">
				<Tabs.List mb="lg">
					<Tabs.Tab
						value="app"
						leftSection={<SlidersHorizontalIcon size={20} />}
					>
						App
					</Tabs.Tab>
					<Tabs.Tab value="chat" leftSection={<ChatCircleIcon size={20} />}>
						Chat
					</Tabs.Tab>
					<Tabs.Tab value="keys" leftSection={<KeyIcon size={20} />}>
						Keys
					</Tabs.Tab>
				</Tabs.List>
				<Tabs.Panel value="app">
					<AppSettings />
				</Tabs.Panel>
				<Tabs.Panel value="chat">
					<ChatSettings embeddingStatus={embeddingStatus} />
				</Tabs.Panel>
				<Tabs.Panel value="keys">
					<KeysSettings />
				</Tabs.Panel>
			</Tabs>
		</Drawer>
	);
}
