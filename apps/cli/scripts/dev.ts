#!/usr/bin/env bun

import { type ChildProcess, spawn } from "node:child_process";
import { watch } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CommonUtils } from "@tiny-chat/core/core/utils/CommonUtils.ts";
import { useServerProcess as startServerProcess } from "../../../scripts/use-server.ts";
import {
	print,
	setExitHandler,
	setPassthrough,
} from "../../../scripts/use-stdout.ts";
import { compile } from "./compile.ts";

let child: ChildProcess | undefined;

const hmr =
	!process.argv.includes("--no-hmr") &&
	!CommonUtils.isTruthy(process.env.NO_HMR);
const argv = process.argv.slice(2).filter((arg) => arg !== "--no-hmr");

async function run() {
	if (child) {
		const previous = child;
		child = undefined;
		previous.kill();
		setPassthrough(false);
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

	const args = ["bun", entrypoint.path, ...argv];
	print({ message: "running", details: `> ${args.join(" ")}` });

	const started = spawn(args[0], args.slice(1), {
		stdio: "inherit",
		env: { ...process.env },
	});
	child = started;
	setPassthrough(true);

	started.on("exit", () => {
		if (child !== started) return;
		child = undefined;
		setPassthrough(false);

		if (hmr) print({ message: "waiting for changes" });
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

	if (!hmr && child) {
		const running = child;
		await new Promise<void>((resolve) => running.once("exit", () => resolve()));
	}

	if (hmr) {
		const watchPath = join(dirname(fileURLToPath(import.meta.url)), "../src");
		print({ message: `watching ${watchPath}` });

		for await (const event of watch(watchPath, { recursive: true })) {
			if (event.eventType === "change") {
				print({ message: `↻ changes: ${event.filename}` });
				await run();
			}
		}
	}
} finally {
	child?.kill();
	await cleanup();
}
