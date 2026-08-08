import { createClient } from "@tiny-chat/client/src/client.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { FileUtils } from "@tiny-chat/core/src/features/file/utils/FileUtils.ts";
import type {
	ModelProvider,
	ModelProviderStatus,
} from "@tiny-chat/core/src/features/provider/types/model.ts";
import type { ProviderState } from "@tiny-chat/core/src/features/provider/types/provider.ts";
import { useEditorStore } from "#app/features/editor/stores/useEditorStore.ts";
import { TauriHttpTransport } from "#app/features/tauri/services/TauriHttpTransport.ts";
import { TauriStdioTransport } from "#app/features/tauri/services/TauriStdioTransport.ts";
import { TauriUtils } from "#app/features/tauri/utils/TauriUtils.ts";

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
	providers: {
		getModelProviders: async ({ user }) => {
			const providers: ModelProvider<any>[] = [];
			if (user.settings.useBrowserModels) {
				const { WebLLMProvider } = await import(
					"./core/services/WebLLMProvider.ts"
				);
				providers.push(WebLLMProvider);
			}
			if (await TauriUtils.isTauriWithAfm()) {
				const { AFMProvider } = await import("./core/services/AFMProvider.ts");
				providers.push(AFMProvider);
			}
			return providers;
		},
		getProviderStates: async ({ user }) => {
			const providers: ProviderState<any>[] = [];
			if (user.settings.useBrowserModels) {
				const { WebLLMProvider } = await import(
					"./core/services/WebLLMProvider.ts"
				);
				providers.push({
					...WebLLMProvider,
					status: await WebLLMProvider.getStatus({ user }),
				} satisfies ProviderState<ModelProviderStatus>);
			}
			if (await TauriUtils.isTauriWithAfm()) {
				const { AFMProvider } = await import("./core/services/AFMProvider.ts");
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
				createStdio: ({ name, command, env }) => {
					return new TauriStdioTransport(name, command, env);
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

			return [[{ type: "text", value: editor.getMarkdown() }]];
		},
		setData: ({ data }) => {
			const { editor } = useEditorStore.getState();
			if (!editor) return;

			editor.commands.setContent(DataUtils.getText({ data, join: "\n" }), {
				contentType: "markdown",
			});
		},
	},
	shell: (await TauriUtils.isTauriDesktop())
		? {
				cwd: async () => {
					return await TauriUtils.invoke<string>("cwd");
				},
				chdir: async ({ path }) => {
					await TauriUtils.invoke("chdir", { path });
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
				writeFile: async ({ path, content }) => {
					await TauriUtils.invoke("write_file", { path, content });
					return { path, success: true };
				},
				// The command reports its output over a channel while it runs; the
				// resolved value still carries all of it.
				exec: async ({ command, onOutput }) => {
					const { Channel } = await import("@tauri-apps/api/core");
					const channel = new Channel<{
						stream: "stdout" | "stderr";
						value: string;
					}>();
					channel.onmessage = (chunk) => onOutput?.(chunk);

					return await TauriUtils.invoke<{
						code?: number;
						stdout: string;
						stderr: string;
					}>("shell_exec", { command, onOutputChannel: channel });
				},
			}
		: undefined,
	desktop: await TauriUtils.isTauriDesktop(),
});
