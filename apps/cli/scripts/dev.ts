#!/usr/bin/env bun

import { type ChildProcess, spawn } from "node:child_process";
import { watch } from "node:fs/promises";
import { useServerProcess as startServerProcess } from "../../../scripts/use-server.ts";
import {
	print,
	setExitHandler,
	setPassthrough,
} from "../../../scripts/use-stdout.ts";
import { compile } from "./compile.ts";

let child: ChildProcess | undefined;

async function run() {
	if (child?.pid) {
		process.kill(child.pid);
	}

	const result = await compile({
		outdir: "./dist",
		target: "bun",
		sourcemap: "inline",
		external: ["@napi-rs/keyring", "@crosscopy/clipboard"],
		dev: true,
	});

	const entrypoint = result?.outputs?.find(
		({ path }) => path.split("/").at(-1) === "index.js",
	);
	if (!entrypoint) {
		print({ message: "waiting for changes" });
		return;
	}

	const args = ["bun", entrypoint.path, ...process.argv.slice(2)];
	print({ message: "running", details: `> ${args.join(" ")}` });

	child = spawn(args[0], args.slice(1), {
		stdio: "inherit",
		env: { ...process.env },
	});
	setPassthrough(true);

	child.on("exit", () => {
		child = undefined;
		setPassthrough(false);

		print({ message: "waiting for changes" });
	});
}

// The dev compiler runs in Bun; keep the backend on Node as before.
const cleanup = await startServerProcess({ execPath: "node" });

setExitHandler((isCtrlD) => {
	if (child?.pid) {
		if (!isCtrlD) return true;
		child.kill();
	}
	void cleanup().then(() => process.exit(0));
	return true;
});

try {
	await run();

	for await (const event of watch("./src", { recursive: true })) {
		if (event.eventType === "change") {
			print({ message: `↻ changes: ${event.filename}` });
			await run();
		}
	}
} finally {
	child?.kill();
	await cleanup();
}
