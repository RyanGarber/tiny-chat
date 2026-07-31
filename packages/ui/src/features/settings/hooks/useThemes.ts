import { useMutation, useQuery } from "@tanstack/react-query";
import { zSettings } from "#core/features/data/types/user.ts";
import { useSession } from "#react/src/core/hooks/useSession.ts";
import { client } from "#ui/client.ts";
import { CODE_THEMES, THEMES } from "#ui/utils/style.ts";

export const useThemes = () => {
	const { session } = useSession();

	const theme = useQuery({
		...client.query.settings.get.queryOptions(),
		select: (data) => (data.theme as (typeof THEMES)[number]) ?? THEMES[0],
		initialData: zSettings.safeParse(session.data?.user?.settings).data ?? {
			theme: THEMES[0],
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
			(data.codeTheme as (typeof CODE_THEMES)[number]) ?? CODE_THEMES[0],
		initialData: zSettings.safeParse(session.data?.user?.settings).data ?? {
			codeTheme: CODE_THEMES[0],
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
