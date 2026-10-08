import { createClient } from "#client/client.ts";
import HighlightWorker from "#core/core/services/HighlightWorker.ts?worker";
import { CommonUtils } from "#core/core/utils/CommonUtils.ts";
import { FileUtils } from "#core/features/file/utils/FileUtils.ts";
import type {
	ModelProvider,
	ModelProviderStatus,
} from "#core/features/provider/types/model.ts";
import type { ProviderState } from "#core/features/provider/types/provider.ts";
import { useEditorStore } from "#gui/features/editor/stores/useEditorStore.ts";
import { EditorUtils } from "#gui/features/editor/utils/EditorUtils.ts";
import { TauriHttpTransport } from "#gui/features/tauri/services/TauriHttpTransport.ts";
import { TauriStdioTransport } from "#gui/features/tauri/services/TauriStdioTransport.ts";
import { TauriUtils } from "#gui/features/tauri/utils/TauriUtils.ts";

const desktopOs = await TauriUtils.desktopOs();

export const client = createClient({
	env: {
		VITE_SERVER_URL: String(import.meta.env.VITE_SERVER_URL),
		VITE_SERVER_PORT: String(import.meta.env.VITE_SERVER_PORT),
		VITE_WEB_URL: String(import.meta.env.VITE_WEB_URL),
		VITE_WEB_PORT: String(import.meta.env.VITE_WEB_PORT),
		DEV: String(import.meta.env.DEV),
	},
	host: __TAURI_DEV_HOST__,
	getToken: () => localStorage.getItem("token"),
	setToken: (token) => localStorage.setItem("token", token ?? ""),
	getStorage: (key) => JSON.parse(localStorage.getItem(key) ?? "null"),
	setStorage: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
	highlighter: () => new HighlightWorker({ name: "highlight" }),
	providers: {
		getModelProviders: async ({ user }) => {
			const providers: ModelProvider<any>[] = [];
			if (user.settings.useBrowserModels) {
				const { WebLLMProvider } = await import(
					"#gui/core/services/WebLLMProvider.ts"
				);
				providers.push(WebLLMProvider);
			}
			if (await TauriUtils.isTauriWithAfm()) {
				const { AFMProvider } = await import(
					"#gui/core/services/AFMProvider.ts"
				);
				providers.push(AFMProvider);
			}
			return providers;
		},
		getProviderStates: async ({ user }) => {
			const providers: ProviderState<any>[] = [];
			if (user.settings.useBrowserModels) {
				const { WebLLMProvider } = await import(
					"#gui/core/services/WebLLMProvider.ts"
				);
				providers.push({
					...WebLLMProvider,
					status: await WebLLMProvider.getStatus({ user }),
				} satisfies ProviderState<ModelProviderStatus>);
			}
			if (await TauriUtils.isTauriWithAfm()) {
				const { AFMProvider } = await import(
					"#gui/core/services/AFMProvider.ts"
				);
				providers.push({
					...AFMProvider,
					status: await AFMProvider.getStatus({ user }),
				} satisfies ProviderState<ModelProviderStatus>);
			}
			return providers;
		},
	},
	transports: (await TauriUtils.isTauriDesktop())
		? {
				createStdio: ({ name, command, env, onStderr }) => {
					return new TauriStdioTransport(name, command, env, onStderr);
				},
				createStreamableHttp: ({ name, url, headers }) => {
					return new TauriHttpTransport(name, String(url), headers);
				},
			}
		: undefined,
	input: {
		getData: () => {
			const { editor } = useEditorStore.getState();
			if (!editor) return [];

			return EditorUtils.getData(editor);
		},
		setData: ({ data }) => {
			const { editor } = useEditorStore.getState();
			if (!editor) return;

			EditorUtils.setData(editor, data);
		},
		insertNode: ({ node }) => {
			EditorUtils.insertNode(node);
		},
	},
	shell: desktopOs
		? {
				os: desktopOs,
				cwd: async () => {
					return await TauriUtils.invoke<string>("cwd");
				},
				resolveDir: async ({ path }) => {
					return await TauriUtils.invoke<string>("resolve_dir", { path });
				},
				locate: async ({ paths }) => {
					return await TauriUtils.invoke<string | null>("locate", { paths });
				},
				readFile: async ({ path }) => {
					const file = await TauriUtils.invoke<{ path: string; data: string }>(
						"read_file",
						{
							path,
						},
					);
					return {
						path: file.path,
						data: FileUtils.getBufferFromBytes(file),
					};
				},
				readFiles: async ({ paths, maxBytes }) => {
					const files = await TauriUtils.invoke<
						({ data: string; size: number } | null)[]
					>("read_files", { paths, maxBytes });
					return files.map(
						(file) =>
							file && {
								data: FileUtils.getBufferFromBytes(file),
								size: file.size,
							},
					);
				},
				readDir: async ({ path }) => {
					const dir = await TauriUtils.invoke<
						{ path: string; is_dir: boolean }[]
					>("read_dir", {
						path,
					});
					return dir.map((item) => ({
						path: item.path,
						is_dir: item.is_dir,
					}));
				},
				walk: async ({ path, maxDepth, maxEntries, prune }) => {
					return await TauriUtils.invoke<{
						root: string;
						entries: { path: string; is_dir: boolean; size?: number }[];
						truncated: boolean;
					}>("walk", { path, maxDepth, maxEntries, prune });
				},
				writeFile: async ({ path, content }) => {
					await TauriUtils.invoke("write_file", { path, content });
					return { path, success: true };
				},
				// The command reports its output over a channel while it runs; the
				// resolved value still carries all of it. It is stopped by the id it
				// was started under.
				spawn: async ({ program, args, cwd, env, stream, abort }) => {
					const { Channel } = await import("@tauri-apps/api/core");
					const channel = new Channel<{
						type: "stdout" | "stderr";
						value: string;
					}>();
					channel.onmessage = (event) => stream?.(event);

					abort?.throwIfAborted();
					const id = CommonUtils.getRandomId();
					const kill = () => void TauriUtils.invoke("shell_kill", { id });
					abort?.addEventListener("abort", kill, { once: true });
					try {
						return await TauriUtils.invoke<{
							code?: number;
							stdout: string;
							stderr: string;
						}>("shell_exec", {
							id,
							program,
							args,
							cwd,
							env,
							onOutputChannel: channel,
						});
					} finally {
						abort?.removeEventListener("abort", kill);
					}
				},
			}
		: undefined,
	desktop: !!desktopOs,
});
