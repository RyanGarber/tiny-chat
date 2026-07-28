import { useMutation, useQuery } from "@tanstack/react-query";
import { auth, query, queryClient } from "#frontend/utils/api.ts";
import { CODE_THEMES, THEMES } from "#frontend/utils/style.ts";
import { zSettings } from "#shared/features/data/types/user.ts";

export const useThemes = () => {
	const session = auth.useSession();

	const theme = useQuery({
		...query.settings.get.queryOptions(),
		select: (data) => (data.theme as (typeof THEMES)[number]) ?? THEMES[0],
		initialData: zSettings.safeParse(session.data?.user?.settings).data ?? {
			theme: THEMES[0],
		},
	});

	const setTheme = useMutation({
		...query.settings.setTheme.mutationOptions(),
		onSuccess: (data) => {
			queryClient.setQueryData(query.settings.get.queryKey(), data);
		},
	});

	const codeTheme = useQuery({
		...query.settings.get.queryOptions(),
		select: (data) =>
			(data.codeTheme as (typeof CODE_THEMES)[number]) ?? CODE_THEMES[0],
		initialData: zSettings.safeParse(session.data?.user?.settings).data ?? {
			codeTheme: CODE_THEMES[0],
		},
	});

	const setCodeTheme = useMutation({
		...query.settings.setCodeTheme.mutationOptions(),
		onSuccess: (data) => {
			queryClient.setQueryData(query.settings.get.queryKey(), data);
		},
	});

	const blackout = useQuery({
		...query.settings.get.queryOptions(),
		select: (data) => data.blackout ?? false,
		initialData: zSettings.safeParse(session.data?.user?.settings).data ?? {
			blackout: false,
		},
	});

	const setBlackout = useMutation({
		...query.settings.setBlackout.mutationOptions(),
		onSuccess: (data) => {
			queryClient.setQueryData(query.settings.get.queryKey(), data);
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
