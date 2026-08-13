export const ShellUtils = {
	/**
	 * Read-only, side-effect-free commands that never warrant an approval prompt
	 * on their own.
	 */
	safeCommands: new Set([
		"ls",
		"pwd",
		"cat",
		"echo",
		"grep",
		"find",
		"head",
		"tail",
		"wc",
		"which",
		"whoami",
		"date",
		"uname",
		"ps",
		"df",
		"du",
		"file",
		"stat",
		"tree",
		"printenv",
		"sort",
		"uniq",
		"cut",
		"diff",
		"basename",
		"dirname",
		"realpath",
	]),

	/** `git` subcommands that only read state and never mutate the repository. */
	safeCommandsGit: new Set([
		"status",
		"diff",
		"log",
		"show",
		"branch",
		"remote",
		"describe",
		"blame",
		"rev-parse",
	]),

	/** Splits a single `&&`-free command segment into its tokens, respecting quotes. */
	parse: (segment: string): string[] => {
		const tokens: string[] = [];
		const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
		let match: RegExpExecArray | null;
		while (true) {
			match = pattern.exec(segment);
			if (!match) break;
			const token = match[1] ?? match[2] ?? match[3];
			if (token !== undefined) tokens.push(token);
		}
		return tokens;
	},

	isSegmentSafe: (segment: string): boolean => {
		const [command, ...args] = ShellUtils.parse(segment);
		if (!command) return false;
		if (ShellUtils.safeCommands.has(command)) return true;
		if (command === "git") {
			const subcommand = args[0];
			return (
				subcommand !== undefined && ShellUtils.safeCommandsGit.has(subcommand)
			);
		}
		return false;
	},

	/**
	 * Parses `command` into its `&&`-separated parts and checks each against the
	 * safe command whitelist. Any other shell control character (`;`, `|`, `` ` ``,
	 * `$()`, redirects, backgrounding, ...) is treated as unsafe since it is not
	 * accounted for here.
	 */
	isSafe: (command: string): boolean => {
		const trimmed = command.trim();
		if (!trimmed) return false;
		if (/[;|`$<>]/.test(trimmed)) return false;
		if (trimmed.replace(/&&/g, "").includes("&")) return false;

		const segments = trimmed.split("&&").map((segment) => segment.trim());
		if (segments.some((segment) => segment.length === 0)) return false;

		return segments.every(ShellUtils.isSegmentSafe);
	},
} as const;
