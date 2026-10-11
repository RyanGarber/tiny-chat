#!/usr/bin/env node

import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { zClientEnv } from "#core/core/types/env.ts";
import { spawn } from "../../../scripts/spawn.ts";
import { useEnv } from "../../../scripts/use-env.ts";

/**
 * An unsigned release of the mobile app, against the production server:
 * `build.ts ios` archives `ios/App/App.xcarchive` (or under `$RUNNER_TEMP`),
 * and `build.ts android` assembles the release APKs under
 * `android/app/build/outputs/apk/release`. Signing is left to whoever
 * distributes them.
 */
const platform = process.argv[2];
if (platform !== "ios" && platform !== "android") {
	throw new Error("usage: build.ts ios|android");
}

process.env.DEV = "";
process.env.DEV_HOST = "";
process.env.DEV_REMOTE = "";
delete process.env.MOBILE_DEV_URL;
useEnv({ type: zClientEnv });

await spawn({
	command: ["pnpm", "exec", "vite", "build"],
	label: ["gui build", "building gui"],
	output: "tail",
});

await spawn({
	command: ["pnpm", "exec", "cap", "sync", platform],
	label: [`${platform} sync`, `syncing ${platform}`],
	output: "tail",
});

if (platform === "ios") {
	const archive = `${process.env.RUNNER_TEMP ?? fileURLToPath(new URL("../ios/App", import.meta.url))}/App.xcarchive`;
	await rm(archive, { recursive: true, force: true });
	await spawn({
		command: [
			"xcodebuild",
			"-project",
			"App.xcodeproj",
			"-scheme",
			"App",
			"-sdk",
			"iphoneos",
			"-destination",
			"generic/platform=iOS",
			"-configuration",
			"Release",
			"-archivePath",
			archive,
			"archive",
			"CODE_SIGN_IDENTITY=",
			"CODE_SIGNING_REQUIRED=NO",
			"CODE_SIGNING_ALLOWED=NO",
			"DEVELOPMENT_TEAM=",
		],
		label: ["ios archive", "archiving ios app"],
		output: "tail",
		cwd: fileURLToPath(new URL("../ios/App", import.meta.url)),
	});
} else {
	await spawn({
		command: [
			process.platform === "win32" ? "gradlew.bat" : "./gradlew",
			"assembleRelease",
		],
		label: ["android assemble", "assembling android apks"],
		output: "tail",
		cwd: fileURLToPath(new URL("../android", import.meta.url)),
	});
}
