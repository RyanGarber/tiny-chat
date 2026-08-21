import { spawn } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { createClient } from "@tiny-chat/client/src/client.ts";
import { AtomUtils } from "@tiny-chat/client/src/features/editor/utils/AtomUtils.ts";
import { AttachmentUtils } from "@tiny-chat/client/src/features/editor/utils/AttachmentUtils.ts";
import type { zEnv } from "@tiny-chat/core/src/core/types/env.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { KeyringService } from "./core/services/KeyringService.ts";
import { StorageService } from "./core/services/StorageService.ts";
import { CliUtils } from "./core/utils/CliUtils.ts";
import {
	insertAttachment,
	useEditorStore,
} from "./features/editor/stores/useEditorStore.ts";

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
			return new StdioClientTransport({
				command: command[0],
				args: command.slice(1),
				env,
			});
		},
		createStreamableHttp: ({ url, headers }) => {
			return new StreamableHTTPClientTransport(new URL(url), {
				requestInit: { headers },
			});
		},
	},
	input: {
		// The editor holds its commands, attachments and long pastes as atoms —
		// short stand-ins for the Markdown they travel as — which are written
		// back out here, and read back in when a message is loaded for editing.
		getData: () => {
			const { content } = useEditorStore.getState();
			return [[{ type: "text", value: AtomUtils.serialize({ content }) }]];
		},
		setData: ({ data }) => {
			const { setContent } = useEditorStore.getState();
			setContent(
				AtomUtils.deserialize(DataUtils.getText({ data, join: "\n" })),
			);
		},
		insertAttachment: ({ item }) => {
			insertAttachment({
				source: item.value,
				directory: item.directory,
				label: item.label,
				markdown: AttachmentUtils.toDirective({ item }),
			});
		},
	},
	shell: {
		cwd: async () => {
			return process.cwd();
		},
		chdir: async ({ path }) => {
			process.chdir(CliUtils.resolve(path));
		},
		readFile: async ({ path }) => {
			path = CliUtils.resolve(path);
			return {
				path,
				data: await readFile(path),
			};
		},
		writeFile: async ({ path, content }) => {
			path = CliUtils.resolve(path);
			await writeFile(path, content);
			return {
				path,
				success: true,
			};
		},
		readDir: async ({ path }) => {
			path = CliUtils.resolve(path);
			const entries = await readdir(path, { withFileTypes: true });
			return entries.map((entry) => ({
				path: CliUtils.resolve(path, entry.name),
				is_dir: entry.isDirectory(),
			}));
		},
		// Spawned rather than buffered so output can be reported as it arrives;
		// the accumulated text is still what the tool result is built from.
		exec: async ({ command, stream }) => {
			return new Promise((resolve) => {
				const child = spawn(command, { shell: true });

				let stdout = "";
				let stderr = "";

				child.stdout?.setEncoding("utf8");
				child.stdout?.on("data", (chunk: string) => {
					stdout += chunk;
					stream?.({ type: "stdout", value: chunk });
				});

				child.stderr?.setEncoding("utf8");
				child.stderr?.on("data", (chunk: string) => {
					stderr += chunk;
					stream?.({ type: "stderr", value: chunk });
				});

				child.on("error", (error) => {
					const value = `${error.message}\n`;
					stderr += value;
					stream?.({ type: "stderr", value });
					resolve({ code: 1, stdout, stderr });
				});

				child.on("close", (code) => {
					resolve({ code: code ?? 0, stdout, stderr });
				});
			});
		},
	},
	desktop: true,
});
