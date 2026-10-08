import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useContext, useMemo } from "react";
import { ClientContext } from "#client/client.ts";
import { useSettings } from "#client/features/settings/hooks/useSettings.ts";
import { SettingsUtils } from "#core/core/utils/SettingsUtils.ts";
import type { ProjectLike } from "#core/features/data/types/chat.ts";
import type { zSettings } from "#core/features/data/types/user.ts";
import { PathUtils } from "#core/features/file/utils/PathUtils.ts";

export const useShellSettings = ({
	project,
}: {
	project?: ProjectLike | null;
}) => {
	const client = useContext(ClientContext);

	const { settings, applySettings } = useSettings({ project });

	const commands = useMemo(() => {
		return SettingsUtils.defaults({
			commands: settings.data?.commands,
		}).commands;
	}, [settings.data?.commands]);

	const addCommand = useMutation({
		...client.query.settings.addCommand.mutationOptions(),
		onSuccess: applySettings,
	});

	const updateCommand = useMutation({
		...client.query.settings.updateCommand.mutationOptions(),
		onSuccess: applySettings,
	});

	const removeCommand = useMutation({
		...client.query.settings.removeCommand.mutationOptions(),
		onSuccess: applySettings,
	});

	const folders = useMemo(() => {
		return SettingsUtils.defaults({ folders: settings.data?.folders }).folders;
	}, [settings.data?.folders]);

	/** Whether each folder can be opened, checked afresh whenever it is shown. */
	const folderStatus = useQuery({
		queryKey: ["useShellSettings", "folderStatus", folders],
		queryFn: async () => {
			const entries = await Promise.all(
				folders.map(async ({ path }): Promise<[string, boolean]> => {
					try {
						const mounted = PathUtils.fromMount({ path });
						if (mounted && PathUtils.isMounted(path)) {
							const { mount, id } = mounted;
							await client.api.file.getDirectory.query({
								path,
								chat: mount === "chat" ? id : undefined,
								uploads: mount === "uploads" && id ? [id] : [],
								skills: mount === "skills" && id ? [id] : [],
							});
						} else if (!client.shell) return [path, false];
						else await client.shell.readDir({ path });
						return [path, true];
					} catch {
						return [path, false];
					}
				}),
			);
			return Object.fromEntries(entries) as Record<string, boolean>;
		},
		enabled: !!client.desktop && folders.length > 0,
		staleTime: 0,
		gcTime: 0,
	});

	/**
	 * The folder a shell starts in on this device: the first that opens here,
	 * or for a project, one it was launched inside. Folders sync across
	 * devices, so the rest may only exist on others.
	 */
	const primaryFolder = useQuery({
		queryKey: [
			"useShellSettings",
			"primaryFolder",
			typeof project === "string" ? project : (project?.id ?? null),
			folderStatus.data,
		],
		queryFn: async () => {
			const available = folders
				.map(({ path }) => path)
				.filter((path) => folderStatus.data?.[path]);
			if (!project) return available[0] ?? null;
			const shell = client.shell;
			return (
				SettingsUtils.preferContaining({
					paths: available,
					cwd: await client.workingDirectory.origin(),
					toShellPath: (path) => shell?.toShellPath?.({ path }) ?? path,
				})[0] ?? null
			);
		},
		enabled: !!folderStatus.data,
	});

	// Folders are tried in order for the shell's working directory.
	const applyFolders = useCallback(
		(settings: zSettings) => {
			applySettings(settings);
			client.workingDirectory.refresh();
		},
		[applySettings, client.workingDirectory],
	);

	const addFolder = useMutation({
		...client.query.settings.addFolder.mutationOptions(),
		onSuccess: applyFolders,
	});

	const updateFolder = useMutation({
		...client.query.settings.updateFolder.mutationOptions(),
		onSuccess: applyFolders,
	});

	const removeFolder = useMutation({
		...client.query.settings.removeFolder.mutationOptions(),
		onSuccess: applyFolders,
	});

	const moveFolder = useMutation({
		...client.query.settings.moveFolder.mutationOptions(),
		onSuccess: applyFolders,
	});

	return {
		commands,
		addCommand,
		updateCommand,
		removeCommand,
		folders,
		folderStatus,
		primaryFolder: primaryFolder.data ?? null,
		addFolder,
		removeFolder,
		updateFolder,
		moveFolder,
	};
};
