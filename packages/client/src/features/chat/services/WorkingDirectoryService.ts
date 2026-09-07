import type { ShellCapability } from "@tiny-chat/core/src/core/types/capability.ts";
import { useChatStore } from "../stores/useChatStore.ts";
import { useMessagingStore } from "../stores/useMessagingStore.ts";

export const WorkingDirectoryService = {
	create: ({
		shell,
		activate,
	}: {
		shell?: ShellCapability;
		activate: (selection: {
			chat: string | null;
			folder: string | null;
		}) => Promise<{ id: string | null; cwd: string | null }>;
	}) => {
		const startingCwd = shell?.cwd?.();
		let queue: Promise<unknown> = startingCwd ?? Promise.resolve();
		let selection = "";
		let active = "";
		const sync = () => {
			const chat = useChatStore.getState().chatId;
			const folder = chat
				? null
				: (useMessagingStore.getState().activeFolder?.id ?? null);
			const key = JSON.stringify([chat, folder]);
			if (key === selection) return;
			selection = key;
			queue = queue
				.catch(() => {})
				.then(async () => {
					let target: { id: string | null; cwd: string | null };
					try {
						target =
							chat || folder
								? await activate({ chat, folder })
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
		// Coalesce newChat's folder and chat updates into one activation.
		const schedule = () => queueMicrotask(sync);
		const unsubscribeChat = useChatStore.subscribe(schedule);
		const unsubscribeFolder = useMessagingStore.subscribe(schedule);
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
				unsubscribeFolder();
			},
		};
	},
} as const;
