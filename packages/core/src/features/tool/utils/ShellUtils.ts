import { type ParsedScript, parse, type Redirect, type Word } from "unbash";
import type {
	Capabilities,
	ShellCapability,
} from "../../../core/types/capability.ts";
import { PathUtils } from "../../file/utils/PathUtils.ts";

const WRITE_REDIRECTS = new Set([">", ">>", "<>", ">|", "&>", "&>>"]);
const FIND_WRITE_ACTIONS = new Set([
	"-delete",
	"-exec",
	"-execdir",
	"-fls",
	"-fprint",
	"-fprint0",
	"-fprintf",
	"-ok",
	"-okdir",
]);
const GIT_BRANCH_WRITE_OPTIONS = new Set([
	"-c",
	"-C",
	"-d",
	"-D",
	"-m",
	"-M",
	"--copy",
	"--delete",
	"--edit-description",
	"--move",
	"--set-upstream-to",
	"--unset-upstream",
]);
const GIT_REMOTE_WRITE_SUBCOMMANDS = new Set([
	"add",
	"prune",
	"remove",
	"rename",
	"set-branches",
	"set-head",
	"set-url",
	"update",
]);

const isStaticWord = (word: Word): boolean =>
	(word.parts ?? []).every((part) => {
		switch (part.type) {
			case "Literal":
			case "SingleQuoted":
			case "AnsiCQuoted":
				return true;
			case "DoubleQuoted":
			case "LocaleString":
				return part.parts.every((child) => child.type === "Literal");
			default:
				return false;
		}
	});

const hasWriteRedirect = (redirect: Redirect): boolean => {
	if (WRITE_REDIRECTS.has(redirect.operator)) {
		return redirect.target?.value !== "/dev/null";
	}
	if (redirect.operator !== ">&") return false;
	return !redirect.target || !/^(?:[0-9]+|-)$/.test(redirect.target.value);
};

const isGitSafe = (args: string[]): boolean => {
	const subcommandIndex = args.findIndex((arg) => !arg.startsWith("-"));
	if (subcommandIndex === -1) return false;
	const subcommand = args[subcommandIndex];
	const subcommandArgs = args.slice(subcommandIndex + 1);
	if (
		subcommandArgs.some(
			(arg) => arg === "--output" || arg.startsWith("--output="),
		)
	) {
		return false;
	}

	if (ShellUtils.safeCommandsGit.has(subcommand)) return true;
	if (subcommand === "branch") {
		if (subcommandArgs.some((arg) => GIT_BRANCH_WRITE_OPTIONS.has(arg))) {
			return false;
		}
		const positional = subcommandArgs.filter((arg) => !arg.startsWith("-"));
		return positional.length === 0 || subcommandArgs.includes("--list");
	}
	if (subcommand === "remote") {
		return !subcommandArgs.some((arg) => GIT_REMOTE_WRITE_SUBCOMMANDS.has(arg));
	}
	return false;
};

const commandWrites = (command: string, args: string[]): boolean => {
	if (command === "find") {
		return args.some((arg) => FIND_WRITE_ACTIONS.has(arg));
	}
	if (command === "sort") {
		return args.some((arg) => arg === "-o" || arg.startsWith("--output="));
	}
	if (command === "uniq") {
		return args.filter((arg) => !arg.startsWith("-")).length > 1;
	}
	if (command === "diff") {
		return args.some(
			(arg) => arg === "--output" || arg.startsWith("--output="),
		);
	}
	if (command === "tree") {
		return args.some((arg) => arg === "-o" || arg.startsWith("--output="));
	}
	return false;
};

const isScriptSafe = (script: ParsedScript): boolean => {
	if (script.errors?.length) return false;

	const seen = new Set<object>();
	const visit = (value: unknown): boolean => {
		if (!value || typeof value !== "object") return true;
		if (seen.has(value)) return true;
		seen.add(value);

		const item = value as Record<string, unknown>;
		if (item.type === "Script" && (value as ParsedScript).errors?.length) {
			return false;
		}
		if ("operator" in item && "target" in item) {
			if (hasWriteRedirect(value as Redirect)) return false;
		}
		if (item.type === "Command") {
			const node = value as {
				name?: Word;
				prefix: unknown[];
				redirects: Redirect[];
				suffix: Word[];
			};
			if (!node.name) {
				return node.prefix.every(visit) && node.redirects.every(visit);
			}
			if (!isStaticWord(node.name)) return false;
			const args = node.suffix.map((word) => word.value);
			const allowed =
				ShellUtils.safeCommands.has(node.name.value) &&
				!commandWrites(node.name.value, args);
			if (!allowed && !(node.name.value === "git" && isGitSafe(args)))
				return false;
		}

		// unbash exposes Word.parts via a lazy, non-enumerable getter.
		if ("text" in item && "value" in item && "pos" in item && "end" in item) {
			const word = value as unknown as Word;
			if (!(word.parts ?? []).every(visit)) return false;
		}
		return Object.keys(item).every((key) =>
			key === "parts" ? true : visit(item[key]),
		);
	};

	return visit(script);
};

export const ShellUtils = {
	/** Read-only commands that can run without an approval prompt. */
	safeCommands: new Set([
		"cd",
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
		"true",
		"false",
		"test",
		"[",
	]),

	/** `git` subcommands whose normal operation only reads repository state. */
	safeCommandsGit: new Set([
		"status",
		"diff",
		"log",
		"show",
		"describe",
		"blame",
		"rev-parse",
		"grep",
		"ls-files",
		"ls-tree",
		"cat-file",
		"name-rev",
		"shortlog",
	]),

	/** Parses the full Bash syntax tree and rejects commands that may write to disk. */
	isSafe: (command: string): boolean => {
		if (!command.trim()) return false;
		try {
			return isScriptSafe(parse(command));
		} catch {
			return false;
		}
	},

	detect: (
		path: string | boolean,
		capabilities: Pick<Capabilities, "shell" | "chatShell">,
	): ShellCapability => {
		if (!capabilities.shell && !capabilities.chatShell) {
			// this shouldn't happen
			throw new Error(
				"You tried to access a path but no shell is accessible. This is most likely a bug. You can try another path if desired or note the issue and move on.",
			);
		}
		const isChat =
			typeof path === "boolean" ? path : PathUtils.fromMount({ path });
		if (isChat) {
			if (!capabilities.chatShell) {
				throw new Error(
					`You tried to access a path inside of ${PathUtils.mount}, but the chat shell is not accessible.${capabilities.shell ? ` If you are able to use the user's shell, call this tool with a path outside of ${PathUtils.mount} and try again.` : ""}`,
				);
			}
			return capabilities.chatShell;
		} else {
			if (!capabilities.shell) {
				throw new Error(
					`You tried to access a path outside of ${PathUtils.mount}, but the user's shell is not accessible.${capabilities.chatShell ? ` If you are able to use the chat shell, call this tool with a path inside of ${PathUtils.mount} and try again.` : ""}`,
				);
			}
			return capabilities.shell;
		}
	},
} as const;
