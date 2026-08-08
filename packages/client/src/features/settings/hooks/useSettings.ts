import { useQuery } from "@tanstack/react-query";
import { zSettings } from "@tiny-chat/core/src/features/data/types/user.ts";
import { useCallback, useContext } from "react";
import { ClientContext } from "../../../client.ts";
import { useSession } from "../../../core/hooks/useSession.ts";

export const settingsQueryKey = ["useSettings", "settings"] as const;

export const useSettings = () => {
	const client = useContext(ClientContext);

	const { session } = useSession();

	const settings = useQuery({
		queryKey: settingsQueryKey,
		queryFn: async () => {
			return client.api.settings.get.query();
		},
		placeholderData: zSettings.safeParse(session.data?.user?.settings).data,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		staleTime: Infinity,
	});

	const applySettings = useCallback(
		(settings: zSettings) => {
			client.queryClient.setQueryData(settingsQueryKey, settings);
			return true;
		},
		[client.queryClient],
	);

	return { settings, applySettings };
};
