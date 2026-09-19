import { ActionIcon, Drawer, Group, ScrollArea, Tabs } from "@mantine/core";
import {
	ChatCircleIcon,
	KeyIcon,
	SlidersHorizontalIcon,
	TerminalWindowIcon,
} from "@phosphor-icons/react";
import type { EmbeddingStatus } from "@tiny-chat/client/src/features/user/hooks/useEmbedding.ts";
import { useAppStore } from "#app/core/stores/useAppStore.ts";
import scrollable from "#app/core/styles/scrollable.module.css";
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
			classNames={scrollable}
		>
			<Tabs
				defaultValue="app"
				variant="pills"
				display="flex"
				flex={1}
				mih={0}
				style={{ flexDirection: "column" }}
			>
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
				<Tabs.Panel value="app" flex={1} mih={0} h={0}>
					<ScrollArea h="100%" offsetScrollbars>
						<AppSettings />
					</ScrollArea>
				</Tabs.Panel>
				<Tabs.Panel value="chat" flex={1} mih={0} h={0}>
					<ScrollArea h="100%" offsetScrollbars>
						<ChatSettings embeddingStatus={embeddingStatus} />
					</ScrollArea>
				</Tabs.Panel>
				<Tabs.Panel value="keys" flex={1} mih={0} h={0}>
					<ScrollArea h="100%" offsetScrollbars>
						<KeysSettings />
					</ScrollArea>
				</Tabs.Panel>
			</Tabs>
		</Drawer>
	);
}
