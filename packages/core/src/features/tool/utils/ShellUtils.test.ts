import { ShellUtils } from "./ShellUtils.ts";

describe("ShellUtils", () => {
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
		"git branch --contains HEAD",
		"git remote -v",
		"git -C ~/repo diff --check && git -C ~/repo status --short && (command -v actionlint || true)",
		"git --no-pager -C ~/repo status --short",
		"git -c color.ui=false -C ~/repo diff --check",
		"git status -C ~/repo",
		"git --version",
		"git config --get remote.origin.url",
		"git config user.name",
		"git config get remote.origin.url",
		"git config list",
		"git remote show update",
		"git for-each-ref --format='%(refname:short)' refs/heads",
		"command -vV actionlint",
		"command -v rm",
		"command -p git status --short",
		"command -- git diff --check",
		"command command git status --short",
		"printf '%s\\n' hello",
		"sed -n '1,20p' file",
		"rg --files packages/core",
		"jq -r '.name' package.json",
		"uniq -f 1 input",
		"echo diagnostic >/dev/stderr",
		"sort -- -ooutput",
		"sed -- -i file",
		"git diff -- --output",
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
		"git -C ~/repo branch new-branch",
		"git -C ~/repo branch -C old-branch new-branch",
		"git branch -D old-branch",
		"git remote add origin example.com/repo.git",
		"git config user.name 'Tiny Chat'",
		"git config --global --unset user.name",
		"git config set user.name 'Tiny Chat'",
		"git config edit",
		"git diff --output changes.patch",
		"command rm file",
		"command -p git branch new-branch",
		"sed -i '' -e 's/old/new/' file",
		"rg --pre 'rm file' needle",
		"fd pattern --exec rm {}",
		"sort input -ooutput",
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
