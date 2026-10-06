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
import { useContext } from "react";
import { ClientContext } from "#client/client.ts";
import { useShellSettings } from "#client/features/settings/hooks/useShellSettings.ts";
import type { ProjectLike } from "#core/features/data/types/chat.ts";

export default function FolderSettings({
	project,
}: {
	project: ProjectLike | null;
}) {
	const client = useContext(ClientContext);

	const { folders, folderStatus, addFolder, removeFolder, updateFolder } =
		useShellSettings({ project });

	const pickFolder = async () => {
		// Loaded on demand so the dialog plugin stays out of the web bundle.
		const { open } = await import("@tauri-apps/plugin-dialog");
		const path = await open({
			directory: true,
			multiple: false,
			defaultPath: folders[0]?.path,
		});
		if (path) addFolder.mutate({ project, folder: { path, whitelist: false } });
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
			{folders.map(({ path, whitelist }, index) => {
				const pending =
					(removeFolder.isPending && removeFolder.variables.index === index) ||
					(updateFolder.isPending && updateFolder.variables.index === index);
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
									checked={whitelist}
									disabled={pending}
									onChange={(event) =>
										updateFolder.mutate({
											project,
											index,
											folder: { whitelist: event.currentTarget.checked },
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
