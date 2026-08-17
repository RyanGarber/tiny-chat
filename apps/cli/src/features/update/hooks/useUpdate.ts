import { useMutation, useQuery } from "@tanstack/react-query";
import { useAppStore } from "../../../core/stores/useAppStore.ts";
import { UpdateService } from "../services/UpdateService.ts";

/** how often a release is looked for, after the look on startup */
const INTERVAL = 60 * 60 * 1000;

export const useUpdate = () => {
	const update = useQuery({
		queryKey: ["useUpdate", "update"],
		queryFn: async (): Promise<string | null> => {
			await UpdateService.clean();
			return await UpdateService.check();
		},
		// A build run from source has no binary of ours to replace, so there is
		// nothing to tell it about.
		enabled: !!UpdateService.binary(),
		refetchInterval: INTERVAL,
		staleTime: INTERVAL,
		retry: false,
	});

	const doUpdate = useMutation({
		mutationFn: async (version: string) => {
			const { setStatus } = useAppStore.getState();

			setStatus({ id: "update", text: `installing v${version}` });

			// The status is only rewritten on a whole percent, which is as much
			// as it can show, rather than on every chunk that arrives.
			let percent: number | null = null;

			await UpdateService.install({
				onProgress: (progress) => {
					if (progress === null) return;

					const next = Math.floor(progress * 100);
					if (next === percent) return;
					percent = next;

					setStatus({
						id: "update",
						text: `installing v${version} - ${next}%`,
					});
				},
			});

			setStatus({
				id: "update",
				text: `v${version} installed - restart to run it`,
				passive: true,
			});
		},
		onError: (error) => {
			useAppStore.getState().setStatus({
				id: "update",
				text: `update failed: ${error.message}`,
				passive: true,
			});
		},
	});

	return { update, doUpdate };
};
