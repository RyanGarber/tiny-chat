#!/usr/bin/env node

// Updates the "version" field in apps/tauri/tauri.conf.json in place, without
// reformatting the rest of the file. This is the single source of truth for
// the app version; semantic-release invokes this via its `exec` plugin.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const nextVersion = process.argv[2];
if (!nextVersion) {
	console.error("Usage: bump-tauri-version.mjs <version>");
	process.exit(1);
}

const configPath = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../apps/tauri/tauri.conf.json",
);

const contents = readFileSync(configPath, "utf8");
const updated = contents.replace(
	/"version":\s*"[^"]*"/,
	`"version": "${nextVersion}"`,
);

if (updated === contents) {
	console.error(`Could not find a "version" field to update in ${configPath}`);
	process.exit(1);
}

writeFileSync(configPath, updated);
console.log(`Bumped ${configPath} to ${nextVersion}`);
