#!/usr/bin/env node

import { spawn } from "node:child_process";
import { useServerProcess } from "./use-server.ts";

const cleanup = await useServerProcess();

try {
	await new Promise<void>((resolve, reject) => {
		const child = spawn("pnpm", ["--filter", "@tiny-chat/cli", "run", "dev"], {
			stdio: "inherit",
			env: process.env,
		});

		child.once("error", reject);
		child.once("exit", (code, signal) => {
			process.exitCode =
				code ?? (signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1);
			resolve();
		});
	});
} finally {
	await cleanup();
}
