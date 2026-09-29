import {
	ActionIcon,
	Box,
	Button,
	Checkbox,
	Group,
	Paper,
	Stack,
	Text,
	Tooltip,
} from "@mantine/core";
import { FolderPlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useShellSettings } from "@tiny-chat/client/features/settings/hooks/useShellSettings.ts";
import type { ProjectLike } from "@tiny-chat/core/features/data/types/chat.ts";
import { client } from "#app/client.ts";

export default function FolderSettings({
	project,
}: {
	project: ProjectLike | null;
}) {
	const { folders, folderStatus, addFolder, removeFolder, setFolderWritable } =
		useShellSettings({ project });

	const pickFolder = async () => {
		// Loaded on demand so the dialog plugin stays out of the web bundle.
		const { open } = await import("@tauri-apps/plugin-dialog");
		const path = await open({
			directory: true,
			multiple: false,
			defaultPath: folders[0]?.path,
		});
		if (path) addFolder.mutate({ project, path });
	};

	return (
		<>
			<Box>
				<Text size="sm">Folders</Text>
				<Text size="xs" c="dimmed">
					{client.desktop
						? "Where the shell works, starting in the first"
						: "Available in the desktop app"}
				</Text>
			</Box>
			{folders.map(({ path, writable }, index) => {
				const pending =
					(removeFolder.isPending && removeFolder.variables.index === index) ||
					(setFolderWritable.isPending &&
						setFolderWritable.variables.index === index);
				return (
					<Paper key={path} withBorder p="xs">
						<Group gap="xs" wrap="nowrap" align="flex-start">
							<Stack gap={6} flex={1} miw={0}>
								<Text
									size="sm"
									ff="monospace"
									style={{ wordBreak: "break-all" }}
								>
									{path}
								</Text>
								{folderStatus.data?.[path] === false && (
									<Text size="xs" c="red">
										This folder is unavailable
									</Text>
								)}
								<Checkbox
									size="xs"
									label="Skip approval for file edits"
									checked={writable}
									disabled={pending}
									onChange={(event) =>
										setFolderWritable.mutate({
											project,
											index,
											writable: event.currentTarget.checked,
										})
									}
								/>
							</Stack>
							<ActionIcon
								variant="subtle"
								onClick={() => removeFolder.mutate({ project, index })}
								disabled={pending}
							>
								<TrashIcon size={20} />
							</ActionIcon>
						</Group>
					</Paper>
				);
			})}
			{client.desktop && (
				<Tooltip label="Choose a folder on this computer" position="right">
					<Button
						variant="default"
						leftSection={<FolderPlusIcon size={20} />}
						onClick={() =>
							pickFolder().catch((error) =>
								console.warn("Folder picker failed", error),
							)
						}
						loading={addFolder.isPending}
						disabled={addFolder.isPending}
					>
						Add Folder
					</Button>
				</Tooltip>
			)}
		</>
	);
}
