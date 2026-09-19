import { useQuery } from "@tanstack/react-query";
import type { FolderLike } from "@tiny-chat/core/src/features/data/types/chat.ts";
import { zSettings } from "@tiny-chat/core/src/features/data/types/user.ts";
import { useCallback, useContext } from "react";
import { ClientContext } from "../../../client.ts";
import { useSession } from "../../../core/hooks/useSession.ts";

export const settingsQueryKey = ["useSettings", "settings"] as const;

export const useSettings = ({
	folder,
}: {
	folder?: FolderLike | null;
} = {}) => {
	const client = useContext(ClientContext);

	const { session } = useSession();

	const folderId = folder && typeof folder === "object" ? folder.id : folder;

	const settings = useQuery({
		queryKey: [...settingsQueryKey, folderId],
		queryFn: async () => {
			return await client.api.settings.get.query({ folder: folderId });
		},
		initialData: !folderId
			? zSettings.safeParse(session.data?.user?.settings).data
			: undefined,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		staleTime: Infinity,
	});

	const applySettings = useCallback(
		(settings: zSettings) => {
			client.queryClient.setQueryData(
				[...settingsQueryKey, folderId],
				settings,
			);
			return true;
		},
		[client.queryClient, folderId],
	);

	return { settings, applySettings };
};
