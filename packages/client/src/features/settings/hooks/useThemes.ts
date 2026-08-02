import { useMutation, useQuery } from "@tanstack/react-query";
import { ThemeUtils } from "@tiny-chat/core/src/core/utils/ThemeUtils.ts";
import { zSettings } from "@tiny-chat/core/src/features/data/types/user.ts";
import { useContext } from "react";
import { ClientProvider } from "../../../client.ts";
import { useSession } from "../../../core/hooks/useSession.ts";

export const useThemes = () => {
	const client = useContext(ClientProvider);
	const { session } = useSession();

	const theme = useQuery({
		...client.query.settings.get.queryOptions(),
		select: (data) =>
			(data.theme as (typeof ThemeUtils.themes)[number]) ??
			ThemeUtils.themes[0],
		initialData: zSettings.safeParse(session.data?.user?.settings).data ?? {
			theme: ThemeUtils.themes[0],
		},
	});

	const setTheme = useMutation({
		...client.query.settings.setTheme.mutationOptions(),
		onSuccess: (data) => {
			client.queryClient.setQueryData(
				client.query.settings.get.queryKey(),
				data,
			);
		},
	});

	const codeTheme = useQuery({
		...client.query.settings.get.queryOptions(),
		select: (data) =>
			(data.codeTheme as (typeof ThemeUtils.codeThemes)[number]) ??
			ThemeUtils.codeThemes[0],
		initialData: zSettings.safeParse(session.data?.user?.settings).data ?? {
			codeTheme: ThemeUtils.codeThemes[0],
		},
	});

	const setCodeTheme = useMutation({
		...client.query.settings.setCodeTheme.mutationOptions(),
		onSuccess: (data) => {
			client.queryClient.setQueryData(
				client.query.settings.get.queryKey(),
				data,
			);
		},
	});

	const blackout = useQuery({
		...client.query.settings.get.queryOptions(),
		select: (data) => data.blackout ?? false,
		initialData: zSettings.safeParse(session.data?.user?.settings).data ?? {
			blackout: false,
		},
	});

	const setBlackout = useMutation({
		...client.query.settings.setBlackout.mutationOptions(),
		onSuccess: (data) => {
			client.queryClient.setQueryData(
				client.query.settings.get.queryKey(),
				data,
			);
		},
	});

	return {
		theme,
		setTheme,
		codeTheme,
		setCodeTheme,
		blackout,
		setBlackout,
	};
};
