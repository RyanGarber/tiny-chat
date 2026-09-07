#!/usr/bin/env node

import { zEnv } from "../packages/core/src/core/types/env.ts";

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
	try {
		console.log(`trying server at ${serverUrl}...`);
		const result = await fetch(serverUrl);
		return result.ok;
	} catch {
		return false;
	}
}

export async function isServerNeeded(start: boolean | null | undefined) {
	if (start !== false) {
		console.log(`checking server availability...`);
		const isLive = await isServerLive();
		console.log(`server is ${isLive ? "live" : "not live"}`);
		if (start === true || !isLive) {
			console.log(`starting server...`);
			return true;
		}
	} else {
		console.log("waiting for a server...");
	}
	return false;
}

export async function useServer(
	then: string[],
	{ start, host }: { start?: boolean | null; host?: true } = {},
) {
	console.log("starting...");

	const doStart = await isServerNeeded(start);

	if (then.length !== 0) {
		console.log(
			`running ${then.length} command${then.length !== 1 ? "s" : ""}...`,
		);

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
					prefixColors: "auto",
				},
			).result;
		} catch (object) {
			if (object instanceof Error) throw object;
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
	console.log("starting...");

	let child: ChildProcess | undefined;
	const doStart = await isServerNeeded(start);

	if (doStart) {
		child = spawn(`pnpm`, ["-w", "dev:server", ...(host ? ["--host"] : [])], {
			stdio: "inherit",
		});

		child.on("exit", (code) => {
			console.log(`server exited with code ${code}`);
			process.exit(code);
		});

		process.on("exit", () => {
			child?.kill();
		});
	}

	await waitOn({ resources: [serverUrl], timeout: 30000 });

	return () => child?.kill();
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
