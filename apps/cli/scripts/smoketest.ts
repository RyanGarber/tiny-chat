#!/usr/bin/env bun

import { spawn } from "node:child_process";
import { create, printout } from "../../../scripts/use-stdout.ts";
import { compile } from "./compile.ts";

const result = await compile({ compile: { outfile: "./dist/tiny-chat" } });

if (!result?.success) {
	process.exit(1);
}

const update = create("checking outputs");

const child = spawn(result.outputs[0].path, ["--help"]);

let stdout = "";
let stderr = "";
child.stdout?.on("data", (data) => {
	stdout += data.toString();
});
child.stderr?.on("data", (data) => {
	stderr += data.toString();
});

child.on("exit", (code) => {
	if (code !== 0) {
		update("checks failed", "error");
		printout({ stdout, stderr });
		process.exit(1);
	} else {
		update("checks passed");
		printout({ stdout, stderr });
		process.exit(0);
	}
});
