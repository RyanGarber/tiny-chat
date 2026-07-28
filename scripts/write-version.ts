#!/usr/bin/env node

// Updates the "version" field in apps/tauri/tauri.conf.json in place, without
// reformatting the rest of the file. This is the single source of truth for
// the app version; semantic-release invokes this via its `exec` plugin.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "@commander-js/extra-typings";

const VERSION_REGEX = /("version":\s*")([^"]*)(")/;

await new Command()
	.argument("<version>", "the new version to write")
	.action(async (version) => {
		console.log(`[write-version] reading existing version...`);
		const configPath = resolve(
			dirname(fileURLToPath(import.meta.url)),
			"../apps/tauri/tauri.conf.json",
		);
		const configContent = await readFile(configPath, "utf8");

		const configVersion = VERSION_REGEX.exec(configContent);
		if (configVersion) {
			console.log(`[write-version] read existing version: ${configVersion[2]}`);
		} else {
			console.error(`[write-version] no existing version found`);
			process.exit(1);
		}

		console.log(`[write-version] writing new version: ${version}...`);
		await writeFile(
			configPath,
			configContent.replace(VERSION_REGEX, `$1${version}$3`),
			"utf8",
		);

		console.log(`[write-version] wrote new version: ${version}`);
	})
	.parseAsync();
