#!/usr/bin/env node

import { Command } from "@commander-js/extra-typings";
import { concurrently } from "concurrently";

const url = `http://localhost:${process.env.VITE_BACKEND_PORT}`;

export async function isBackendLive() {
	try {
		const result = await fetch(url);
		return result.ok;
	} catch {
		return false;
	}
}

export async function useBackend(
	then: string[],
	{ start, host }: { start?: boolean; host?: true },
) {
	console.log("starting...");

	let doStart = false;

	if (start !== false) {
		console.log(`checking status of backend...`);
		const isLive = await isBackendLive();
		console.log(`backend is ${isLive ? "live" : "not live"}`);
		if (start === true || !isLive) {
			console.log(`starting the backend...`);
			doStart = true;
		}
	} else {
		console.log("waiting for the backend...");
	}

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
									name: "backend",
									command: `pnpm -w dev:backend ${host ? "--host" : ""}`,
								},
							]
						: []),
					...then.map((then) => {
						const [, name, command] =
							/^(?:\[([^\]]+)])?\s*(.*)$/.exec(then) ?? [];
						return { name, command: `wait-on ${url} && ${command}` };
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

await new Command()
	.option("--start", "start the backend if it is not already running")
	.option("--no-start", "wait for an already existing backend")
	.option("--host", "arguments to pass to the backend")
	.argument("<then...>", "commands with an optional 'name:' prefix")
	.action(useBackend)
	.parseAsync();
