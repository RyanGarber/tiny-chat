import { ShellPathUtils } from "#client/features/shell/utils/ShellPathUtils.ts";
import type { ShellEnvironment } from "#core/core/types/capability.ts";

/** A process to start: what a runtime's `spawn` is handed. */
export type ShellProcess = {
	program: string;
	args: string[];
	/** Where it starts, as the host spells it. Unset leaves it to the program. */
	cwd?: string;
	env?: Record<string, string>;
};

/**
 * How one kind of shell is started, and how it spells paths. `cwd` is always
 * the host's spelling; `toShell` and `toHost` translate between the two.
 */
export type ShellLauncher = {
	environment: ShellEnvironment;
	exec: (_: { command: string; cwd: string }) => ShellProcess;
	run: (_: { program: string; args: string[]; cwd: string }) => ShellProcess;
	toShell: (path: string) => string;
	toHost: (path: string) => string;
};

/** Where Windows keeps the shells worth preferring over Windows PowerShell. */
export const WINDOWS_SHELLS = {
	gitBash: [
		"C:\\Program Files\\Git\\bin\\bash.exe",
		"~\\AppData\\Local\\Programs\\Git\\bin\\bash.exe",
	],
	pwsh: ["C:\\Program Files\\PowerShell\\7\\pwsh.exe"],
} as const;

const identity = (path: string) => path;

/**
 * A script for `-EncodedCommand`: base64 of its UTF-16LE bytes. Passed this
 * way, no quote in it is lost to how PowerShell re-reads its command line.
 */
const encodePowerShell = (script: string) => {
	let binary = "";
	for (let i = 0; i < script.length; i++) {
		const code = script.charCodeAt(i);
		binary += String.fromCharCode(code & 0xff, code >> 8);
	}
	return btoa(binary);
};

/** Output as UTF-8, rather than the console's code page. */
const POWERSHELL_PREAMBLE =
	"$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;";

export const ShellLaunchUtils = {
	/** `sh -c`, as on macOS and Linux. */
	posix: ({ os }: { os: "macos" | "linux" }): ShellLauncher => ({
		environment: {
			os,
			dialect: "bash",
			label: `sh on ${os === "macos" ? "macOS" : "Linux"}`,
		},
		exec: ({ command, cwd }) => ({
			program: "/bin/sh",
			args: ["-c", command],
			cwd,
		}),
		run: ({ program, args, cwd }) => ({ program, args, cwd }),
		toShell: identity,
		toHost: identity,
	}),

	powershell: ({ program }: { program: string }): ShellLauncher => {
		const core = /pwsh(?:\.exe)?$/i.test(program);
		return {
			environment: {
				os: "windows",
				dialect: "powershell",
				label: core ? "PowerShell 7 on Windows" : "Windows PowerShell",
			},
			exec: ({ command, cwd }) => ({
				program,
				args: [
					"-NoLogo",
					"-NoProfile",
					"-NonInteractive",
					"-EncodedCommand",
					encodePowerShell(`${POWERSHELL_PREAMBLE}\n${command}`),
				],
				cwd,
			}),
			run: ({ program, args, cwd }) => ({ program, args, cwd }),
			toShell: identity,
			toHost: identity,
		};
	},

	gitBash: ({ program }: { program: string }): ShellLauncher => ({
		environment: {
			os: "windows",
			dialect: "bash",
			label: "Git Bash on Windows",
		},
		exec: ({ command, cwd }) => ({
			program,
			args: ["-lc", command],
			cwd,
			// A login shell otherwise starts over in the home directory.
			env: { CHERE_INVOKING: "1" },
		}),
		run: ({ program, args, cwd }) => ({ program, args, cwd }),
		toShell: ShellPathUtils.toMsys,
		toHost: ShellPathUtils.fromMsys,
	}),

	/**
	 * bash inside a WSL distro. Commands go through `wsl.exe` with the Linux
	 * directory to start in; `-e` hands it the arguments as they are rather
	 * than to the distro's shell to split again.
	 */
	wsl: ({ distro, host }: { distro: string; host?: string }): ShellLauncher => {
		const toShell = (path: string) => ShellPathUtils.toWsl({ path, distro });
		const enter = (cwd: string) => ["-d", distro, "--cd", toShell(cwd), "-e"];
		return {
			environment: {
				os: "windows",
				dialect: "bash",
				label: `bash in WSL (${distro}) on Windows`,
			},
			exec: ({ command, cwd }) => ({
				program: "wsl.exe",
				args: [...enter(cwd), "bash", "-lc", command],
			}),
			run: ({ program, args, cwd }) => ({
				program: "wsl.exe",
				args: [...enter(cwd), program, ...args],
			}),
			toShell,
			toHost: (path) => ShellPathUtils.fromWsl({ path, distro, host }),
		};
	},

	/**
	 * The shell a platform runs commands in when nothing says otherwise. On
	 * Windows that is Git Bash when it is installed, since models know bash
	 * best; then PowerShell 7; then the Windows PowerShell every machine has.
	 */
	native: ({
		os,
		gitBash,
		pwsh,
	}: {
		os: ShellEnvironment["os"];
		gitBash?: string | null;
		pwsh?: string | null;
	}): ShellLauncher => {
		if (os !== "windows") return ShellLaunchUtils.posix({ os });
		if (gitBash) return ShellLaunchUtils.gitBash({ program: gitBash });
		return ShellLaunchUtils.powershell({ program: pwsh ?? "powershell.exe" });
	},

	/** WSL for a directory inside a distro, and `native` for anything else. */
	forDirectory: ({
		path,
		native,
	}: {
		path: string;
		native: ShellLauncher;
	}): ShellLauncher => {
		const wsl = ShellPathUtils.parseWsl(path);
		return wsl
			? ShellLaunchUtils.wsl({ distro: wsl.distro, host: wsl.host })
			: native;
	},
} as const;
