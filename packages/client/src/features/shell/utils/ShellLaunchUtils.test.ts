import { describe, expect, it } from "vitest";
import { ShellLaunchUtils } from "#client/features/shell/utils/ShellLaunchUtils.ts";

const decode = (encoded: string) => {
	const binary = atob(encoded);
	let text = "";
	for (let i = 0; i < binary.length; i += 2) {
		text += String.fromCharCode(
			binary.charCodeAt(i) | (binary.charCodeAt(i + 1) << 8),
		);
	}
	return text;
};

describe("ShellLaunchUtils", () => {
	it("runs sh on macOS and Linux", () => {
		const launcher = ShellLaunchUtils.native({ os: "macos" });
		expect(launcher.environment).toEqual({
			os: "macos",
			dialect: "bash",
			label: "sh on macOS",
		});
		expect(launcher.exec({ command: "ls", cwd: "/work" })).toEqual({
			program: "/bin/sh",
			args: ["-c", "ls"],
			cwd: "/work",
		});
	});

	it("prefers Git Bash, then PowerShell 7, then Windows PowerShell", () => {
		const gitBash = "C:\\Program Files\\Git\\bin\\bash.exe";
		const pwsh = "C:\\Program Files\\PowerShell\\7\\pwsh.exe";
		expect(
			ShellLaunchUtils.native({ os: "windows", gitBash, pwsh }).environment
				.label,
		).toBe("Git Bash on Windows");
		expect(
			ShellLaunchUtils.native({ os: "windows", pwsh }).environment.label,
		).toBe("PowerShell 7 on Windows");
		const fallback = ShellLaunchUtils.native({ os: "windows" });
		expect(fallback.environment).toEqual({
			os: "windows",
			dialect: "powershell",
			label: "Windows PowerShell",
		});
	});

	it("passes PowerShell its command encoded, quotes and all", () => {
		const launcher = ShellLaunchUtils.powershell({ program: "pwsh.exe" });
		const command = `Write-Output "it's \u00e9t\u00e9"`;
		const process = launcher.exec({ command, cwd: "C:\\work" });
		expect(process.program).toBe("pwsh.exe");
		expect(process.cwd).toBe("C:\\work");
		const script = decode(process.args.at(-1) ?? "");
		expect(script.endsWith(`\n${command}`)).toBe(true);
		expect(script).toContain("UTF8");
	});

	it("starts Git Bash where it was asked to, in /c spelling", () => {
		const launcher = ShellLaunchUtils.gitBash({ program: "bash.exe" });
		expect(launcher.exec({ command: "pwd", cwd: "C:\\work" })).toEqual({
			program: "bash.exe",
			args: ["-lc", "pwd"],
			cwd: "C:\\work",
			env: { CHERE_INVOKING: "1" },
		});
		expect(launcher.toShell("C:\\work")).toBe("/c/work");
		expect(launcher.toHost("/c/work")).toBe("C:\\work");
	});

	it("runs WSL commands in the distro, in its Linux directory", () => {
		const native = ShellLaunchUtils.native({ os: "windows" });
		const launcher = ShellLaunchUtils.forDirectory({
			path: "\\\\wsl.localhost\\Ubuntu\\home\\me\\proj",
			native,
		});
		expect(launcher.environment).toEqual({
			os: "windows",
			dialect: "bash",
			label: "bash in WSL (Ubuntu) on Windows",
		});
		const cwd = "\\\\wsl.localhost\\Ubuntu\\home\\me\\proj";
		expect(launcher.exec({ command: "make test", cwd })).toEqual({
			program: "wsl.exe",
			args: [
				"-d",
				"Ubuntu",
				"--cd",
				"/home/me/proj",
				"-e",
				"bash",
				"-lc",
				"make test",
			],
		});
		expect(launcher.run({ program: "git", args: ["status"], cwd })).toEqual({
			program: "wsl.exe",
			args: ["-d", "Ubuntu", "--cd", "/home/me/proj", "-e", "git", "status"],
		});
		expect(launcher.toHost("/home/me/a.txt")).toBe(
			"\\\\wsl.localhost\\Ubuntu\\home\\me\\a.txt",
		);
		expect(launcher.toShell("C:\\Users")).toBe("/mnt/c/Users");
	});

	it("keeps the native shell outside of WSL", () => {
		const native = ShellLaunchUtils.native({ os: "windows" });
		expect(ShellLaunchUtils.forDirectory({ path: "C:\\work", native })).toBe(
			native,
		);
	});
});
