#!/usr/bin/env node

import { Command } from "@commander-js/extra-typings";
import { concurrently } from "concurrently";

const url = `http://localhost:${process.env.VITE_SERVER_PORT}`;

export async function isBackendLive() {
	try {
		const result = await fetch(url);
		return result.ok;
	} catch {
		return false;
	}
}

export async function useServer(
	then: string[],
	{ start, host }: { start?: boolean | null; host?: true },
) {
	console.log("starting...");

	let doStart = false;

	if (start !== false) {
		console.log(`checking server availability...`);
		const isLive = await isBackendLive();
		console.log(`server is ${isLive ? "live" : "not live"}`);
		if (start === true || !isLive) {
			console.log(`starting server...`);
			doStart = true;
		}
	} else {
		console.log("waiting for a server...");
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
									name: "server",
									command: `pnpm -w dev:server ${host ? "--host" : ""}`,
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
	.option("--start", "start a server if one is not already running")
	.option("--no-start", "wait for an already existing server")
	.option("--host", "arguments to pass to the server")
	.argument("<then...>", "commands with an optional 'name:' prefix")
	.action(useServer)
	.parseAsync();
