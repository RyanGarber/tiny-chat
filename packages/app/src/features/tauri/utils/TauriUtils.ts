export const TauriUtils = {
	isTauri: () => {
		return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
	},

	isTauriDesktop: async () => {
		if (!TauriUtils.isTauri()) {
			return false;
		}

		const { type } = await import("@tauri-apps/plugin-os");
		return ["linux", "macos", "windows"].includes(type());
	},

	isTauriWithAfm: async () => {
		if (!TauriUtils.isTauri()) {
			return false;
		}

		const { type } = await import("@tauri-apps/plugin-os");
		if (!["macos", "ios"].includes(type())) return false;
		return await TauriUtils.invoke<boolean>("afm_enabled");
	},

	invoke: async <T>(
		command: string,
		args?: Record<string, unknown>,
	): Promise<T> => {
		if (!TauriUtils.isTauri()) {
			throw new Error(`invoke(${command}) called outside of tauri`);
		}

		const { invoke } = await import("@tauri-apps/api/core");
		return await invoke<T>(command, args).catch((error) => {
			throw new Error(
				`invoke(${command}) failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		});
	},

	listen: async <T>(event: string, callback: (data: T) => void) => {
		if (!TauriUtils.isTauri()) {
			throw new Error(`listen(${event}) called outside of tauri`);
		}

		const { listen } = await import("@tauri-apps/api/event");
		return await listen<T>(event, (event) => callback(event.payload));
	},

	open: async (url: string) => {
		if (TauriUtils.isTauri()) {
			const { openUrl } = await import("@tauri-apps/plugin-opener");
			await openUrl(url);
			return;
		} else {
			window.open(url, "_blank", "noopener,noreferrer");
		}
	},
} as const;
