import { useChatStore } from "#client/features/chat/stores/useChatStore.ts";
import { useMessagingStore } from "#client/features/chat/stores/useMessagingStore.ts";
import type { ShellCapability } from "#core/core/types/capability.ts";
import { SettingsUtils } from "#core/core/utils/SettingsUtils.ts";

type Target = {
	id: string | null;
	candidates: string[];
	projectCandidates: string[];
};

export const WorkingDirectoryService = {
	create: ({
		shell,
		activate,
	}: {
		shell?: ShellCapability;
		activate: (selection: {
			chatId: string | null;
			projectId: string | null;
		}) => Promise<Target>;
	}) => {
		const startingCwd = shell?.cwd?.();
		let queue: Promise<unknown> = startingCwd ?? Promise.resolve();
		let selection = "";
		let active = "";
		/** The folders that resolved here, the one the shell is in first. */
		let resolved: string[] = [];

		const sync = () => {
			const chatId = useChatStore.getState().chatId;
			const projectId = chatId
				? null
				: (useMessagingStore.getState().project?.id ?? null);

			const key = JSON.stringify([chatId, projectId]);
			if (key === selection) return;

			selection = key;
			queue = queue
				.catch(() => {})
				.then(async () => {
					let target: Target;
					try {
						target =
							chatId || projectId
								? await activate({ chatId, projectId })
								: { id: null, candidates: [], projectCandidates: [] };
					} catch (error) {
						active = "";
						resolved = [];
						if (shell?.chdir && startingCwd)
							await shell.chdir({ path: await startingCwd });
						throw error;
					}

					const next = JSON.stringify(target);
					if (next === active) return;

					active = next;
					resolved = [];
					if (!shell?.chdir || !startingCwd) return;

					// Folders sync across devices: start in the first that exists
					// here, preferring a project folder the runtime was launched in.
					const original = await startingCwd;
					const candidates = [
						...new Set([
							...SettingsUtils.preferContaining({
								paths: target.projectCandidates,
								cwd: original,
								toShellPath: (path) => shell.toShellPath?.({ path }) ?? path,
							}),
							...target.candidates,
						]),
					];
					const found: string[] = [];
					for (const path of candidates) {
						try {
							await shell.chdir({ path: original });
							await shell.chdir({ path });
							found.push(path);
						} catch {
							/* Not on this device. */
						}
					}
					try {
						await shell.chdir({ path: original });
						if (found[0]) await shell.chdir({ path: found[0] });
					} catch {
						await shell.chdir({ path: original });
					}
					resolved = found;
				});
			void queue.catch((error) =>
				console.warn("Working directory activation failed", error),
			);
		};

		// Coalesce newChat's project and chat updates into one activation.
		const schedule = () => queueMicrotask(sync);

		const unsubscribeChat = useChatStore.subscribe(schedule);
		const unsubscribeProject = useMessagingStore.subscribe(schedule);

		schedule();

		const ready = async () => {
			sync();
			await queue;
		};

		return {
			ready,
			/** Where the runtime was launched, before any folder moved it. */
			origin: async () => (await startingCwd?.catch(() => null)) ?? null,
			folders: async () => {
				await ready().catch(() => {});
				return resolved;
			},
			refresh: () => {
				selection = "";
				sync();
			},
			dispose: () => {
				unsubscribeChat();
				unsubscribeProject();
			},
		};
	},
} as const;
