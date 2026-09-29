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
const GIT_BRANCH_READ_OPTIONS_WITH_VALUES = new Set([
	"--contains",
	"--format",
	"--merged",
	"--no-contains",
	"--no-merged",
	"--points-at",
	"--sort",
]);
const GIT_GLOBAL_OPTIONS = new Set([
	"--bare",
	"--glob-pathspecs",
	"--icase-pathspecs",
	"--literal-pathspecs",
	"--no-advice",
	"--no-lazy-fetch",
	"--no-optional-locks",
	"--no-pager",
	"--no-replace-objects",
	"--noglob-pathspecs",
	"--paginate",
	"-P",
	"-p",
]);
const GIT_INFO_OPTIONS = new Set([
	"--exec-path",
	"--help",
	"--html-path",
	"--info-path",
	"--man-path",
	"--version",
	"-h",
	"-v",
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
const GIT_CONFIG_WRITE_OPTIONS = new Set([
	"--add",
	"--edit",
	"--remove-section",
	"--rename-section",
	"--replace-all",
	"--unset",
	"--unset-all",
	"-e",
]);
const GIT_CONFIG_WRITE_ACTIONS = new Set([
	"edit",
	"remove-section",
	"rename-section",
	"set",
	"unset",
]);
const GIT_CONFIG_READ_ACTIONS = new Set(["get", "list"]);
const GIT_CONFIG_READ_OPTIONS = new Set([
	"--get",
	"--get-all",
	"--get-color",
	"--get-colorbool",
	"--get-regexp",
	"--get-urlmatch",
	"--list",
	"-l",
]);
const GIT_CONFIG_OPTIONS_WITH_VALUES = new Set([
	"--blob",
	"--default",
	"--file",
	"--type",
	"-f",
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
		return ![
			"/dev/fd/1",
			"/dev/fd/2",
			"/dev/null",
			"/dev/stderr",
			"/dev/stdout",
		].includes(redirect.target?.value ?? "");
	}
	if (redirect.operator !== ">&") return false;
	return !redirect.target || !/^(?:[0-9]+|-)$/.test(redirect.target.value);
};

const getOptionArgs = (args: string[]): string[] => {
	const end = args.indexOf("--");
	return end === -1 ? args : args.slice(0, end);
};

const getGitSubcommand = (
	args: string[],
): { args: string[]; name: string } | "info" | undefined => {
	let hasInfoOption = false;
	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		if (arg === "--") {
			const name = args[index + 1];
			return name ? { name, args: args.slice(index + 2) } : undefined;
		}
		if (arg === "-C" || arg === "-c") {
			if (!args[++index]) return undefined;
			continue;
		}
		if (GIT_GLOBAL_OPTIONS.has(arg)) continue;
		if (
			GIT_INFO_OPTIONS.has(arg) ||
			arg.startsWith("--exec-path=") ||
			arg.startsWith("--list-cmds=")
		) {
			hasInfoOption = true;
			continue;
		}
		if (
			arg.startsWith("--config-env=") ||
			arg.startsWith("--git-dir=") ||
			arg.startsWith("--namespace=") ||
			arg.startsWith("--work-tree=")
		) {
			continue;
		}
		if (arg.startsWith("-")) return undefined;
		return { name: arg, args: args.slice(index + 1) };
	}
	return hasInfoOption ? "info" : undefined;
};

const isGitBranchSafe = (args: string[]): boolean => {
	let list = false;
	let positional = 0;
	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		if (
			[...GIT_BRANCH_WRITE_OPTIONS].some(
				(option) =>
					arg === option ||
					(option.startsWith("--")
						? arg.startsWith(`${option}=`)
						: arg.startsWith(option)),
			)
		) {
			return false;
		}
		if (arg === "--list" || arg === "-l") {
			list = true;
			continue;
		}
		if (GIT_BRANCH_READ_OPTIONS_WITH_VALUES.has(arg)) {
			if (!args[++index]) return false;
			continue;
		}
		if (arg === "--") {
			positional += args.length - index - 1;
			break;
		}
		if (!arg.startsWith("-")) positional++;
	}
	return positional === 0 || list;
};

const isGitConfigSafe = (args: string[]): boolean => {
	let readAction = false;
	let positional = 0;
	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		if (
			GIT_CONFIG_WRITE_OPTIONS.has(arg) ||
			[...GIT_CONFIG_WRITE_OPTIONS].some(
				(option) => option.startsWith("--") && arg.startsWith(`${option}=`),
			)
		) {
			return false;
		}
		if (GIT_CONFIG_READ_OPTIONS.has(arg)) {
			readAction = true;
			continue;
		}
		if (GIT_CONFIG_OPTIONS_WITH_VALUES.has(arg)) {
			if (!args[++index]) return false;
			continue;
		}
		if (arg === "--") {
			positional += args.length - index - 1;
			break;
		}
		if (!arg.startsWith("-")) {
			if (positional === 0 && GIT_CONFIG_WRITE_ACTIONS.has(arg)) return false;
			if (positional === 0 && GIT_CONFIG_READ_ACTIONS.has(arg)) {
				readAction = true;
			}
			positional++;
		}
	}
	return readAction || positional <= 1;
};

const isGitSafe = (args: string[]): boolean => {
	const invocation = getGitSubcommand(args);
	if (!invocation) return false;
	if (invocation === "info") return true;
	const { args: subcommandArgs, name: subcommand } = invocation;
	if (
		getOptionArgs(subcommandArgs).some(
			(arg) => arg === "--output" || arg.startsWith("--output="),
		)
	) {
		return false;
	}

	if (ShellUtils.safeCommandsGit.has(subcommand)) return true;
	if (subcommand === "branch") return isGitBranchSafe(subcommandArgs);
	if (subcommand === "config") return isGitConfigSafe(subcommandArgs);
	if (subcommand === "remote") {
		const remoteSubcommand = subcommandArgs.find((arg) => !arg.startsWith("-"));
		return (
			!remoteSubcommand || !GIT_REMOTE_WRITE_SUBCOMMANDS.has(remoteSubcommand)
		);
	}
	return false;
};

const uniqWrites = (args: string[]): boolean => {
	let positional = 0;
	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		if (arg === "--") return positional + args.length - index - 1 > 1;
		if (
			[
				"-f",
				"-s",
				"-w",
				"--check-chars",
				"--skip-chars",
				"--skip-fields",
			].includes(arg)
		) {
			index++;
			continue;
		}
		if (!arg.startsWith("-")) positional++;
	}
	return positional > 1;
};

const commandWrites = (command: string, args: string[]): boolean => {
	if (command === "find") {
		return args.some((arg) => FIND_WRITE_ACTIONS.has(arg));
	}
	const optionArgs = getOptionArgs(args);
	if (command === "sort") {
		return optionArgs.some(
			(arg) =>
				arg === "-o" ||
				arg.startsWith("-o") ||
				arg === "--output" ||
				arg.startsWith("--output="),
		);
	}
	if (command === "uniq") {
		return uniqWrites(args);
	}
	if (command === "diff") {
		return optionArgs.some(
			(arg) => arg === "--output" || arg.startsWith("--output="),
		);
	}
	if (command === "tree") {
		return optionArgs.some(
			(arg) =>
				arg === "-o" ||
				arg.startsWith("-o") ||
				arg === "--output" ||
				arg.startsWith("--output="),
		);
	}
	if (command === "sed") {
		return optionArgs.some(
			(arg) => arg.startsWith("-i") || arg.startsWith("--in-place"),
		);
	}
	if (command === "rg") {
		return optionArgs.some(
			(arg) => arg === "--pre" || arg.startsWith("--pre="),
		);
	}
	if (command === "fd") {
		return optionArgs.some(
			(arg) =>
				["--exec", "--exec-batch", "-X", "-x"].includes(arg) ||
				arg.startsWith("-X") ||
				arg.startsWith("-x") ||
				arg.startsWith("--exec=") ||
				arg.startsWith("--exec-batch="),
		);
	}
	return false;
};

type Whitelist = (command: string, args: string[]) => boolean;

/** Matches a whole command against `*` (any run of characters) and `?` globs. */
const createWhitelist = (patterns: readonly string[]): Whitelist => {
	const regexes = patterns
		.map((pattern) => pattern.trim().replace(/\s+/g, " "))
		.filter(Boolean)
		.map(
			(pattern) =>
				new RegExp(
					`^${pattern
						.split("")
						.map((char) =>
							char === "*"
								? ".*"
								: char === "?"
									? "."
									: char.replace(/[.+^${}()|[\]\\]/g, "\\$&"),
						)
						.join("")}$`,
				),
		);
	return (command, args) => {
		if (!regexes.length) return false;
		const text = [command, ...args].join(" ");
		return regexes.some((regex) => regex.test(text));
	};
};

const isCommandBuiltinSafe = (
	args: string[],
	whitelist: Whitelist,
): boolean => {
	let inspectsCommands = false;
	let index = 0;
	for (; index < args.length; index++) {
		const arg = args[index];
		if (arg === "--") {
			index++;
			break;
		}
		if (arg === "--help") return true;
		if (!arg.startsWith("-") || arg === "-") break;
		if (!/^-[pVv]+$/.test(arg)) return false;
		if (/[Vv]/.test(arg)) inspectsCommands = true;
	}
	if (inspectsCommands || index === args.length) return true;
	const command = args[index];
	return command
		? isInvocationSafe(command, args.slice(index + 1), whitelist)
		: true;
};

const isInvocationSafe = (
	command: string,
	args: string[],
	whitelist: Whitelist,
): boolean => {
	if (whitelist(command, args)) return true;
	if (command === "command") return isCommandBuiltinSafe(args, whitelist);
	return (
		(ShellUtils.safeCommands.has(command) && !commandWrites(command, args)) ||
		(command === "git" && isGitSafe(args))
	);
};

const isScriptSafe = (script: ParsedScript, whitelist: Whitelist): boolean => {
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
			if (!isInvocationSafe(node.name.value, args, whitelist)) return false;
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
		"cmp",
		"column",
		"comm",
		"basename",
		"cksum",
		"dirname",
		"expand",
		"fd",
		"fmt",
		"fold",
		"groups",
		"id",
		"join",
		"jq",
		"md5sum",
		"nl",
		"od",
		"paste",
		"printf",
		"readlink",
		"realpath",
		"rev",
		"rg",
		"sed",
		"sha1sum",
		"sha256sum",
		"sha512sum",
		"strings",
		"tr",
		"true",
		"type",
		"unexpand",
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
		"check-attr",
		"check-ignore",
		"count-objects",
		"name-rev",
		"for-each-ref",
		"merge-base",
		"range-diff",
		"shortlog",
		"show-index",
		"show-ref",
		"verify-commit",
		"verify-pack",
		"verify-tag",
	]),

	/**
	 * Parses the full Bash syntax tree and rejects commands that may write to
	 * disk. Every simple command — including those in `$(...)`, pipes and `&&`
	 * chains — must be read-only or match a `whitelist` glob such as
	 * `npm run *`. Write redirects are rejected even on whitelisted commands.
	 */
	isSafe: (command: string, whitelist: readonly string[] = []): boolean => {
		if (!command.trim()) return false;
		try {
			return isScriptSafe(parse(command), createWhitelist(whitelist));
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
