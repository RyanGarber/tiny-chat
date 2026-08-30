import { describe, expect, it } from "vitest";
import { ShellUtils } from "./ShellUtils.ts";

describe("ShellUtils.isSafe", () => {
	it.each([
		"pwd",
		"cat file | grep needle | wc -l",
		"cd packages/core && (pwd; echo $(date))",
		"cat <(grep needle file)",
		"echo `pwd`",
		"value=$(git rev-parse HEAD)",
		'if test -f package.json; then git status --short; else echo "missing"; fi',
		'for file in a b; do basename "$file"; done',
		"cat < input 2>&1",
		"echo diagnostic >/dev/null",
		"git branch",
		"git branch --list 'codex/*'",
		"git remote -v",
	])("allows read-only Bash: %s", (command) => {
		expect(ShellUtils.isSafe(command)).toBe(true);
	});

	it.each([
		"",
		"rm file",
		"echo hello > output.txt",
		"echo hello >> output.txt",
		"echo hello >& output.txt",
		"cat <> file",
		"echo $(rm file)",
		"cat <(rm file)",
		"find . -delete",
		"find . -exec rm {} \\;",
		"sort input -o output",
		"uniq input output",
		"diff a b --output=changes",
		"tree -o listing.txt",
		"git branch new-branch",
		"git branch -D old-branch",
		"git remote add origin example.com/repo.git",
		"git diff --output changes.patch",
		"echo $(if test -f x; then cat x; else echo nope > y; fi)",
		"echo 'unterminated",
	])("rejects disk writes or invalid Bash: %s", (command) => {
		expect(ShellUtils.isSafe(command)).toBe(false);
	});

	it("loads through the package bundler", async () => {
		const module = await import("./ShellUtils.ts");
		expect(module.ShellUtils.isSafe("pwd")).toBe(true);
	});
});
