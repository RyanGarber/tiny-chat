import { useMutation, useQuery } from "@tanstack/react-query";
import { useTauriStore } from "#app/features/tauri/stores/useTauriStore.ts";
import { TauriUtils } from "#app/features/tauri/utils/TauriUtils.ts";

interface UpdateBoxed {
	version: string;
	currentVersion: string;
	date: string | undefined;
}

export const useTauri = () => {
	const dismissedUpdate = useTauriStore((state) => state.dismissedUpdate);

	const tauriUpdate = useQuery({
		queryKey: ["tauriUpdate"],
		queryFn: async (): Promise<UpdateBoxed | null> => {
			if (!(await TauriUtils.isTauriDesktop()) || import.meta.env.DEV) {
				return null;
			}

			const { check } = await import("@tauri-apps/plugin-updater");
			const update = await check();

			if (update?.version && update.version !== dismissedUpdate) {
				return update as UpdateBoxed;
			}

			return null;
		},
	});

	const doTauriUpdate = useMutation({
		mutationFn: async (data: UpdateBoxed) => {
			const Update = (await import("@tauri-apps/plugin-updater")).Update
				.prototype;
			const update = data as typeof Update | null;

			if (!update) {
				return;
			}

			let current = 0;
			let total: number | undefined;

			// TODO - move
			void useTauriStore
				.getState()
				.addTask(
					"update",
					`Downloading ${update?.version ? `v${update.version}` : "update"}`,
					"App will update and restart",
				);

			await update.downloadAndInstall((event) => {
				if (event.event === "Started") {
					total = event.data.contentLength;
				}
				if (event.event === "Progress") {
					current += event.data.chunkLength;
					if (total)
						void useTauriStore
							.getState()
							.updateTask("update", (current / total) * 100);
				}
			});

			await useTauriStore.getState().removeTask("update");

			await (await import("@tauri-apps/plugin-process")).relaunch();
		},
	});

	const isTauriDesktop = useQuery({
		queryKey: ["isTauriDesktop"],
		queryFn: async () => {
			return await TauriUtils.isTauriDesktop();
		},
	});

	return { tauriUpdate, doTauriUpdate, isTauriDesktop };
};
