import { describe, expect, it } from "vitest";
import { ShellCommandUtils } from "#client/features/shell/utils/ShellCommandUtils.ts";

describe("ShellCommandUtils.parse", () => {
	it("reads a message as no command", () => {
		expect(ShellCommandUtils.parse("hello !there")).toBeNull();
		expect(ShellCommandUtils.parse("")).toBeNull();
	});

	it("reads what follows the prefix as the command", () => {
		expect(ShellCommandUtils.parse("!git status")).toBe("git status");
		expect(ShellCommandUtils.parse("  ! ls -la \n")).toBe("ls -la");
	});

	it("keeps a command written over several lines", () => {
		expect(ShellCommandUtils.parse("!echo a &&\necho b")).toBe(
			"echo a &&\necho b",
		);
	});

	it("reads the prefix alone as an empty command", () => {
		expect(ShellCommandUtils.parse("!")).toBe("");
	});
});
