import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { create, printout } from "../../../scripts/use-stdout.ts";

const MANIFEST = join(
	dirname(fileURLToPath(import.meta.url)),
	"../../../lib/computer/Cargo.toml",
);

const FILE =
	process.platform === "win32"
		? "computer.dll"
		: process.platform === "darwin"
			? "libcomputer.dylib"
			: "libcomputer.so";

type Profile = "debug" | "release";

const cargo = (args: string[]) =>
	new Promise<{ code: number | null; output: string }>((resolve) => {
		let output = "";
		const child = spawn("cargo", args);
		child.stdout.on("data", (chunk) => {
			output += chunk;
		});
		child.stderr.on("data", (chunk) => {
			output += chunk;
		});
		child.on("error", (error) =>
			resolve({ code: null, output: String(error) }),
		);
		child.on("close", (code) => resolve({ code, output }));
	});

const builds = new Map<Profile, Promise<string | null>>();

const build = async (profile: Profile) => {
	const update = create(`building computer (${profile})`);

	// A release from CI has to carry it; a local build only loses the tool.
	const fail = (details: string) => {
		update("failed to build computer", process.env.CI ? "error" : "warning");
		printout({ stdout: "", stderr: details });
		if (process.env.CI) throw new Error("lib/computer is required in CI");
		return null;
	};

	const args = ["build", "--manifest-path", MANIFEST];
	if (profile === "release") args.push("--release");
	const built = await cargo(args);
	if (built.code !== 0) return fail(built.output);

	const library = join(dirname(MANIFEST), "target", profile, FILE);
	if (!existsSync(library)) return fail(`${library} was not produced`);

	update("built computer");
	return library;
};

/**
 * lib/computer's dynamic library, built once per process for the CLI to embed
 * — null where it cannot be built (no Rust toolchain), which only leaves the
 * computer tool out.
 */
export const buildComputer = (profile: Profile) => {
	let library = builds.get(profile);
	if (!library) {
		library = build(profile);
		builds.set(profile, library);
	}
	return library;
};
