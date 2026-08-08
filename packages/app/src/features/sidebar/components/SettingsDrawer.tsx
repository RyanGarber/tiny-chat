import { Icon } from "@iconify/react";
import { ActionIcon, Drawer, Group, Tabs } from "@mantine/core";

import { useAppStore } from "#app/core/stores/useAppStore.ts";
import AppSettings from "#app/features/sidebar/components/AppSettings.tsx";
import ChatSettings from "#app/features/sidebar/components/ChatSettings.tsx";
import KeysSettings from "#app/features/sidebar/components/KeysSettings.tsx";

export default function SettingsDrawer({
	opened,
	onClose,
}: {
	opened: boolean;
	onClose: () => void;
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
						<Icon icon="lucide:logs" />
					</ActionIcon>
				</Group>
			}
		>
			<Tabs defaultValue="app" variant="pills">
				<Tabs.List mb="lg">
					<Tabs.Tab
						value="app"
						leftSection={<Icon icon="lucide:settings-2" height={18} />}
					>
						App
					</Tabs.Tab>
					<Tabs.Tab
						value="chat"
						leftSection={<Icon icon="lucide:message-circle" height={18} />}
					>
						Chat
					</Tabs.Tab>
					<Tabs.Tab
						value="keys"
						leftSection={<Icon icon="lucide:key-round" height={18} />}
					>
						Keys
					</Tabs.Tab>
				</Tabs.List>
				<Tabs.Panel value="app">
					<AppSettings />
				</Tabs.Panel>
				<Tabs.Panel value="chat">
					<ChatSettings />
				</Tabs.Panel>
				<Tabs.Panel value="keys">
					<KeysSettings />
				</Tabs.Panel>
			</Tabs>
		</Drawer>
	);
}
