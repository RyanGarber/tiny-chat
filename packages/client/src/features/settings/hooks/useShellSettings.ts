import { useMutation, useQuery } from "@tanstack/react-query";
import { SettingsUtils } from "@tiny-chat/core/core/utils/SettingsUtils.ts";
import type { ProjectLike } from "@tiny-chat/core/features/data/types/chat.ts";
import type { zSettings } from "@tiny-chat/core/features/data/types/user.ts";
import { PathUtils } from "@tiny-chat/core/features/file/utils/PathUtils.ts";
import { useCallback, useContext, useMemo } from "react";
import { ClientContext } from "../../../client.ts";
import { useSettings } from "./useSettings.ts";

export const useShellSettings = ({
	project,
}: {
	project?: ProjectLike | null;
}) => {
	const client = useContext(ClientContext);

	const { settings, applySettings } = useSettings({ project });

	const commandWhitelist = useMemo(() => {
		return SettingsUtils.defaults({
			commandWhitelist: settings.data?.commandWhitelist,
		}).commandWhitelist;
	}, [settings.data?.commandWhitelist]);

	const addCommand = useMutation({
		...client.query.settings.addCommand.mutationOptions(),
		onSuccess: applySettings,
	});

	const editCommand = useMutation({
		...client.query.settings.editCommand.mutationOptions(),
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
						if (mounted) {
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

	// The first folder is the shell's working directory.
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

	const removeFolder = useMutation({
		...client.query.settings.removeFolder.mutationOptions(),
		onSuccess: applyFolders,
	});

	const setFolderWritable = useMutation({
		...client.query.settings.setFolderWritable.mutationOptions(),
		onSuccess: applyFolders,
	});

	return {
		commandWhitelist,
		addCommand,
		editCommand,
		removeCommand,
		folders,
		folderStatus,
		addFolder,
		removeFolder,
		setFolderWritable,
	};
};
