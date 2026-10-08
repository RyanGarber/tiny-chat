#!/usr/bin/env bun

import { type ChildProcess, spawn } from "node:child_process";
import { watch } from "node:fs/promises";
import { resolve } from "node:path";
import { CommonUtils } from "#core/core/utils/CommonUtils.ts";
import { useServerProcess as startServerProcess } from "../../../scripts/use-server.ts";
import {
	print,
	setExitHandler,
	setPassthrough,
} from "../../../scripts/use-stdout.ts";
import { compile } from "./compile.ts";

const hmr =
	!process.argv.includes("--no-hmr") &&
	!CommonUtils.isTruthy(process.env.NO_HMR);
const argv = process.argv.slice(2).filter((arg) => arg !== "--no-hmr");

let child: ChildProcess | undefined;

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
		metafile: true,
	});

	const entrypoint = result?.outputs?.find(
		({ path }) => path.split("/").at(-1) === "index.js",
	);
	if (!entrypoint) {
		print({ level: "warning", message: "no entrypoint found" });
		return null;
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

	if (!result?.metafile) {
		print({ level: "warning", message: "no metafile found" });
		return null;
	}

	return Object.keys(result.metafile.inputs)
		.map((p) => resolve(process.cwd(), p))
		.filter((p) => !p.includes("/node_modules/"));
}

const abort = new AbortController();

async function reload(inputs: string[] | null) {
	try {
		if (!inputs) {
			print({ level: "warning", message: "nothing to watch" });
			return;
		}

		print({ message: `watching ${inputs.length} files` });
		const event = await Promise.any(
			inputs.map(async (input) => {
				return watch(input, { signal: abort.signal })
					[Symbol.asyncIterator]()
					.next();
			}),
		);

		print({ message: `↻ changes: ${event.value?.filename}` });
		const newInputs = await run();
		await reload(newInputs);
	} finally {
		abort.abort();
	}
}

// The dev compiler runs in Bun; keep the backend on Node as before.
// Quiet, as its logs would land in the middle of the CLI's UI; they are on disk.
const cleanup = await startServerProcess({ execPath: "node", quiet: true });

setExitHandler((isCtrlD) => {
	if (child?.pid) {
		if (!isCtrlD) return true;
		child.kill();
	}
	void cleanup().then(() => process.exit(0));
	return true;
});

try {
	const inputs = await run();

	if (!hmr && child) {
		const running = child;
		await new Promise<void>((resolve) => running.once("exit", () => resolve()));
	}

	if (hmr) {
		await reload(inputs);
	}
} finally {
	child?.kill();
	await cleanup();
}
