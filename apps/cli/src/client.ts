import { exec } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { createClient } from "@tiny-chat/client/src/client.ts";
import type { zEnv } from "@tiny-chat/core/src/core/types/env.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { quote } from "shell-quote";
import { KeyringService } from "./core/services/KeyringService.ts";
import { StorageService } from "./core/services/StorageService.ts";
import { OsUtils } from "./core/utils/OsUtils.ts";
import { useInputStore } from "./features/editor/stores/useInputStore.ts";

export const client = createClient({
	env: {
		VITE_SERVER_URL: String(process.env.VITE_SERVER_URL),
		VITE_SERVER_PORT: String(process.env.VITE_SERVER_PORT),
		VITE_WEB_URL: String(process.env.VITE_WEB_URL),
		VITE_WEB_PORT: String(process.env.VITE_WEB_PORT),
		DEV: String(process.env.DEV),
	} satisfies zEnv,
	getToken: () => KeyringService.getSessionToken(),
	setToken: (token) => KeyringService.setSessionToken(token ?? ""),
	getStorage: (key) => StorageService.get(key),
	setStorage: (key, value) => StorageService.set(key, value),
	transports: {
		createStdio: ({ command, env }) => {
			return new StdioClientTransport({ command: quote(command), env });
		},
		createStreamableHttp: ({ url, headers }) => {
			return new StreamableHTTPClientTransport(new URL(url), {
				requestInit: { headers },
			});
		},
	},
	input: {
		getData: () => {
			const { content } = useInputStore.getState();
			return [[{ type: "text", value: content }]];
		},
		setData: ({ data }) => {
			const { setContent } = useInputStore.getState();
			setContent(DataUtils.getText({ data, join: "\n" }));
		},
	},
	shell: {
		readFile: async ({ path }) => {
			path = OsUtils.resolve(path);
			return {
				path,
				data: await readFile(path),
			};
		},
		writeFile: async ({ path, content }) => {
			path = OsUtils.resolve(path);
			await writeFile(path, content);
			return {
				path,
				success: true,
			};
		},
		readDir: async ({ path }) => {
			path = OsUtils.resolve(path);
			const entries = await readdir(path, { withFileTypes: true });
			return entries.map((entry) => ({
				path: OsUtils.resolve(path, entry.name),
				is_dir: entry.isDirectory(),
			}));
		},
		searchFiles: async () => {
			throw new Error("not yet implemented");
		},
		exec: async ({ command }) => {
			return new Promise((resolve) => {
				exec(command, (error, stdout, stderr) => {
					resolve({
						code: (error?.code as number) ?? 0,
						stdout,
						stderr,
					});
				});
			});
		},
	},
	desktop: true,
});
