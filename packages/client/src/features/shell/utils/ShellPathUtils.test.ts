import { describe, expect, it } from "vitest";
import { ShellPathUtils } from "#client/features/shell/utils/ShellPathUtils.ts";

describe("ShellPathUtils", () => {
	it("parses every spelling of a WSL path", () => {
		const expected = {
			host: "wsl.localhost",
			distro: "Ubuntu",
			linux: "/home/me",
		};
		expect(
			ShellPathUtils.parseWsl("\\\\wsl.localhost\\Ubuntu\\home\\me"),
		).toEqual(expected);
		expect(ShellPathUtils.parseWsl("//wsl.localhost/Ubuntu/home/me/")).toEqual(
			expected,
		);
		expect(
			ShellPathUtils.parseWsl("\\\\?\\UNC\\wsl.localhost\\Ubuntu\\home\\me"),
		).toEqual(expected);
		expect(ShellPathUtils.parseWsl("\\\\wsl$\\Debian")).toEqual({
			host: "wsl$",
			distro: "Debian",
			linux: "/",
		});
		expect(ShellPathUtils.parseWsl("\\\\server\\share\\x")).toBeNull();
		expect(ShellPathUtils.parseWsl("C:\\Users\\me")).toBeNull();
		expect(ShellPathUtils.parseWsl("/home/me")).toBeNull();
	});

	it("round-trips paths through WSL", () => {
		const distro = "Ubuntu";
		const unc = "\\\\wsl.localhost\\Ubuntu\\home\\me\\proj";
		expect(ShellPathUtils.toWsl({ path: unc, distro })).toBe("/home/me/proj");
		expect(ShellPathUtils.fromWsl({ path: "/home/me/proj", distro })).toBe(unc);
		expect(
			ShellPathUtils.fromWsl({ path: "/home/me", distro, host: "wsl$" }),
		).toBe("\\\\wsl$\\Ubuntu\\home\\me");
	});

	it("maps Windows drives to WSL's /mnt and back", () => {
		const distro = "Ubuntu";
		expect(ShellPathUtils.toWsl({ path: "C:\\Users\\me", distro })).toBe(
			"/mnt/c/Users/me",
		);
		expect(ShellPathUtils.toWsl({ path: "D:\\", distro })).toBe("/mnt/d");
		expect(ShellPathUtils.fromWsl({ path: "/mnt/c/Users/me", distro })).toBe(
			"C:\\Users\\me",
		);
		expect(ShellPathUtils.fromWsl({ path: "/mnt/data", distro })).toBe(
			"\\\\wsl.localhost\\Ubuntu\\mnt\\data",
		);
	});

	it("leaves paths WSL cannot name alone", () => {
		const distro = "Ubuntu";
		const other = "\\\\wsl.localhost\\Debian\\home";
		expect(ShellPathUtils.toWsl({ path: other, distro })).toBe(other);
		expect(ShellPathUtils.fromWsl({ path: other, distro })).toBe(other);
		expect(ShellPathUtils.fromWsl({ path: "relative", distro })).toBe(
			"relative",
		);
	});

	it("maps Git Bash drive paths", () => {
		expect(ShellPathUtils.toMsys("C:\\Users\\me")).toBe("/c/Users/me");
		expect(ShellPathUtils.toMsys("C:/Users/me")).toBe("/c/Users/me");
		expect(ShellPathUtils.fromMsys("/c/Users/me")).toBe("C:\\Users\\me");
		expect(ShellPathUtils.fromMsys("/c")).toBe("C:\\");
		expect(ShellPathUtils.fromMsys("/tmp/x")).toBe("/tmp/x");
		expect(ShellPathUtils.toMsys("\\\\server\\share")).toBe("//server/share");
	});
});
