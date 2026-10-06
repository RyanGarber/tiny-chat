import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { AFMService } from "#cli/core/services/AFMService.ts";
import { StorageService } from "#cli/core/services/StorageService.ts";
import { TokenService } from "#cli/core/services/TokenService.ts";
import { FileSystemUtils } from "#cli/core/utils/FileSystemUtils.ts";
import { createClient } from "#client/client.ts";
import type { CodeWorker } from "#core/core/utils/CodeUtils.ts";
import type { ProviderState } from "#core/features/provider/types/provider.ts";
import { ToolOutputUtils } from "#core/features/tool/utils/ToolOutputUtils.ts";
import { CliUtils } from "#tui/core/utils/CliUtils.ts";
import { EditorInputService } from "#tui/features/editor/services/EditorInputService.ts";

export const client = createClient({
	env: {
		VITE_SERVER_URL: String(process.env.VITE_SERVER_URL),
		VITE_SERVER_PORT: String(process.env.VITE_SERVER_PORT),
		VITE_WEB_URL: String(process.env.VITE_WEB_URL),
		VITE_WEB_PORT: String(process.env.VITE_WEB_PORT),
		DEV: String(process.env.DEV),
	},
	getToken: () => TokenService.get(),
	setToken: (token) => TokenService.set(token),
	getStorage: (key) => StorageService.get(key),
	setStorage: (key, value) => StorageService.set(key, value),
	highlighter: () => {
		// Bun's Web Worker (the CLI is typed against Node, not Bun)
		const { Worker } = globalThis as unknown as {
			Worker: new (url: URL) => CodeWorker & { unref: () => void };
		};
		// built beside the bundle (`scripts/compile.ts`); `import.meta.url` is
		// the bundle's, in `dist/` and in a compiled binary alike
		const worker = new Worker(new URL("./highlight.js", import.meta.url));
		// an idle highlighter shouldn't keep the CLI from exiting
		worker.unref();
		return worker;
	},
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
	providers: {
		getModelProviders: async () => {
			const afm = await AFMService.getProvider();
			return afm ? [afm] : [];
		},
		getProviderStates: async ({ user }) => {
			const afm = await AFMService.getProvider();
			if (!afm) return [];
			return [
				{ ...afm, status: await afm.getStatus({ user }) },
			] satisfies ProviderState<any>[];
		},
	},
	input: EditorInputService,
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
			mkdirSync(dirname(path), { recursive: true });
			await writeFile(path, content);
			return {
				path,
				success: true,
			};
		},
		readFiles: async ({ paths, maxBytes }) =>
			await FileSystemUtils.readFiles({
				paths: paths.map((path) => CliUtils.resolve(path)),
				maxBytes,
			}),
		readDir: async ({ path }) => {
			path = CliUtils.resolve(path);
			const entries = await readdir(path, { withFileTypes: true });
			return entries.map((entry) => ({
				path: CliUtils.resolve(path, entry.name),
				is_dir: entry.isDirectory(),
			}));
		},
		walk: async ({ path, ...options }) =>
			await FileSystemUtils.walk({ path: CliUtils.resolve(path), ...options }),
		// Spawned rather than buffered so output can be reported as it arrives;
		// the accumulated text is still what the tool result is built from. Its
		// own process group, so an interrupt reaches everything the shell
		// started rather than only the shell.
		exec: async ({ command, stream, abort }) => {
			return new Promise((resolve) => {
				const child = spawn(command, {
					shell: true,
					detached: process.platform !== "win32",
				});

				const stdout = ToolOutputUtils.collect();
				const stderr = ToolOutputUtils.collect();

				let settled = false;
				const settle = (code: number) => {
					if (settled) return;
					settled = true;
					abort?.removeEventListener("abort", kill);
					resolve({ code, stdout: stdout.text(), stderr: stderr.text() });
				};

				const signal = (name: NodeJS.Signals) => {
					if (child.pid === undefined) return;
					try {
						if (process.platform === "win32") child.kill(name);
						else process.kill(-child.pid, name);
					} catch {
						// Already gone.
					}
				};
				function kill() {
					signal("SIGTERM");
					// Whatever ignores the polite request does not get a second one.
					setTimeout(() => signal("SIGKILL"), 2000).unref();
					settle(130);
				}
				if (abort?.aborted) kill();
				else abort?.addEventListener("abort", kill, { once: true });

				child.stdout?.setEncoding("utf8");
				child.stdout?.on("data", (chunk: string) => {
					if (settled) return;
					stdout.push(chunk);
					stream?.({ type: "stdout", value: chunk });
				});

				child.stderr?.setEncoding("utf8");
				child.stderr?.on("data", (chunk: string) => {
					if (settled) return;
					stderr.push(chunk);
					stream?.({ type: "stderr", value: chunk });
				});

				child.on("error", (error) => {
					const value = `${error.message}\n`;
					stderr.push(value);
					stream?.({ type: "stderr", value });
					settle(1);
				});

				child.on("close", (code) => {
					settle(code ?? 0);
				});
			});
		},
	},
	desktop: true,
});
