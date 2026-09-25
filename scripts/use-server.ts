#!/usr/bin/env node

import { zEnv } from "../packages/core/src/core/types/env.ts";
import { create, print } from "./use-stdout.ts";

config({ path: resolve(import.meta.dirname, "../.env"), quiet: true });
try {
	zEnv.parse({ ...process.env });
} catch {
	throw new Error("invalid environment");
}

import { type ChildProcess, spawn } from "node:child_process";
import { resolve } from "node:path";
import { Command } from "@commander-js/extra-typings";
import { concurrently } from "concurrently";
import { config } from "dotenv";
import waitOn from "wait-on";

export const serverUrl = `http://localhost:${process.env.VITE_SERVER_PORT}`;

export async function isServerLive() {
	const update = create(`trying server at ${serverUrl}`);
	try {
		const result = await fetch(serverUrl, {
			signal: AbortSignal.timeout(5_000),
		});
		update(`server is ${result.ok ? "live" : "not live"}`);
		return result.ok;
	} catch {
		update("server is not live");
		return false;
	}
}

export async function isServerNeeded(start: boolean | null | undefined) {
	if (start !== false) {
		const isLive = await isServerLive();
		if (start === true || !isLive) {
			print({ message: "starting server..." });
			return true;
		}
	} else {
		print({ message: "waiting for a server..." });
	}
	return false;
}

export async function useServer(
	then: string[],
	{ start, host }: { start?: boolean | null; host?: true } = {},
) {
	print({ message: "starting..." });

	const doStart = await isServerNeeded(start);

	if (then.length !== 0) {
		print({
			message: `running ${then.length} command${then.length !== 1 ? "s" : ""}...`,
		});
		try {
			await concurrently(
				[
					...(doStart
						? [
								{
									name: "server",
									command: `pnpm -w dev:server ${host ? "--host" : ""}`,
								},
							]
						: []),
					...then.map((then) => {
						const [, name, command] =
							/^(?:\[([^\]]+)])?\s*(.*)$/.exec(then) ?? [];
						return { name, command: `wait-on ${serverUrl} && ${command}` };
					}),
				],
				{
					killOthersOn: ["success", "failure"],
					killTimeout: 5_000,
					prefixColors: "auto",
				},
			).result;
		} catch (object) {
			if (object instanceof Error) throw object;
			// concurrently rejects with exit events when a command fails.
			process.exitCode = 1;
		}
	}
}

export async function useServerProcess({
	start,
	host,
}: {
	start?: boolean | null;
	host?: true;
} = {}) {
	print({ message: "starting..." });

	let child: ChildProcess | undefined;
	const doStart = await isServerNeeded(start);

	let stopping = false;
	const cleanup = async () => {
		stopping = true;
		process.off("exit", onExit);
		if (!child || child.exitCode !== null || child.signalCode !== null) return;
		const exited = new Promise<void>((resolve) =>
			child?.once("exit", () => resolve()),
		);
		child.kill();
		const timer = setTimeout(() => child?.kill("SIGKILL"), 5_000);
		try {
			await exited;
		} finally {
			clearTimeout(timer);
		}
	};
	const onExit = () => child?.kill();

	if (doStart) {
		// Own the actual server process, without pnpm wrappers or a file watcher.
		child = spawn(
			process.execPath,
			[
				resolve(import.meta.dirname, "../packages/server/src/server.ts"),
				...(host ? ["--host"] : []),
			],
			{
				stdio: "inherit",
				env: process.env,
			},
		);
		process.once("exit", onExit);
	}

	try {
		await Promise.race([
			waitOn({ resources: [serverUrl], timeout: 30_000 }),
			...(child
				? [
						new Promise<never>((_resolve, reject) => {
							child?.once("error", reject);
							child?.once("exit", (code, signal) => {
								if (!stopping)
									reject(new Error(`Server exited with ${signal ?? code}`));
							});
						}),
					]
				: []),
		]);
	} catch (error) {
		await cleanup();
		throw error;
	}

	return cleanup;
}

if (import.meta.main) {
	await new Command()
		.option("--start", "start a server if one is not already running")
		.option("--no-start", "wait for an already existing server")
		.option("--host", "arguments to pass to the server")
		.argument("<then...>", "commands with an optional 'name:' prefix")
		.action(useServer)
		.parseAsync();
}
