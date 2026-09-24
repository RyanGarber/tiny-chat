#!/usr/bin/env node

import { spawn } from "node:child_process";
import { create, printout } from "../../../scripts/use-stdout.ts";

const update = create("trying server");

const child = spawn("pnpm", ["-w", "start:server", "--", "--smoke"]);

let stdout = "";
let stderr = "";
child.stdout?.on("data", (data) => {
	stdout += data.toString();
});
child.stderr?.on("data", (data) => {
	stderr += data.toString();
});

child.on("exit", (code) => {
	if ((stdout + stderr).includes("EADDRINUSE")) {
		update("server started but port is in use", "warning");
		printout({ stdout, stderr });
		process.exit(0);
	} else if (code !== 0) {
		update("server failed to start", "error");
		printout({ stdout, stderr });
		process.exit(1);
	} else {
		update("server started successfully");
		printout({ stdout, stderr });
		process.exit(0);
	}
});

const start = Date.now();
while (child.exitCode === null) {
	await new Promise((resolve) => setTimeout(resolve, 1000));
	if (Date.now() - start > 30000) {
		update("timed out waiting for server to start", "error");
		printout({ stdout, stderr });
		process.exit(1);
	}
}
