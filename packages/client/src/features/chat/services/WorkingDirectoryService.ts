import { useChatStore } from "#client/features/chat/stores/useChatStore.ts";
import { useMessagingStore } from "#client/features/chat/stores/useMessagingStore.ts";
import type { ShellCapability } from "#core/core/types/capability.ts";

export const WorkingDirectoryService = {
	create: ({
		shell,
		activate,
	}: {
		shell?: ShellCapability;
		activate: (selection: {
			chatId: string | null;
			projectId: string | null;
		}) => Promise<{ id: string | null; cwd: string | null }>;
	}) => {
		const startingCwd = shell?.cwd?.();
		let queue: Promise<unknown> = startingCwd ?? Promise.resolve();
		let selection = "";
		let active = "";

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
					let target: { id: string | null; cwd: string | null };
					try {
						target =
							chatId || projectId
								? await activate({ chatId, projectId })
								: { id: null, cwd: null };
					} catch (error) {
						active = "";
						if (shell?.chdir && startingCwd)
							await shell.chdir({ path: await startingCwd });
						throw error;
					}

					const next = JSON.stringify(target);
					if (next === active) return;

					active = next;
					if (!shell?.chdir || !startingCwd) return;

					const original = await startingCwd;
					try {
						await shell.chdir({ path: original });
						if (target.cwd) await shell.chdir({ path: target.cwd });
					} catch {
						await shell.chdir({ path: original });
					}
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

		return {
			ready: async () => {
				sync();
				await queue;
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
