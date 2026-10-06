import type { GitChange } from "#client/features/chat/types/chatFiles.ts";
import { PathUtils } from "#core/features/file/utils/PathUtils.ts";

/** What `git diff` compares against before a repository has a commit. */
const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

export const GitUtils = {
	EMPTY_TREE,

	/** A path as one shell word. Paths are passed with forward slashes. */
	quote: (path: string) => `"${path.replace(/(["$`\\])/g, "\\$1")}"`,

	/** `git` run in `directory`. */
	command: (directory: string, ...args: string[]) =>
		["git", "-C", GitUtils.quote(directory), ...args].join(" "),

	/** A path below a repository's root, joined back onto it. */
	join: (root: string, path: string) =>
		`${root.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`,

	/**
	 * The root of a repository, from a directory in it and that directory's
	 * `rev-parse --show-prefix`. Worked out from the directory rather than
	 * asked of git, so it is spelled the way the chat spells it even where git
	 * would have resolved a symlink along the way.
	 */
	root: ({ directory, prefix }: { directory: string; prefix: string }) => {
		const base = PathUtils.normalize({ path: directory, unix: true }).replace(
			/\/+$/,
			"",
		);
		const below = prefix.trim().replace(/\/+$/, "");
		if (!below) return base || "/";
		if (!base.endsWith(`/${below}`)) return null;
		return base.slice(0, -(below.length + 1)) || "/";
	},

	/** `git diff --numstat --no-renames -z`, as changes under `root`. */
	numstat: ({ root, output }: { root: string; output: string }) =>
		output.split("\0").flatMap((record): GitChange[] => {
			const match = /^(-|\d+)\t(-|\d+)\t(.+)$/s.exec(record.replace(/^\n/, ""));
			if (!match) return [];
			const [, additions, deletions, path] = match;
			const binary = additions === "-";
			return [
				{
					path: GitUtils.join(root, path),
					additions: binary ? 0 : Number(additions),
					deletions: binary ? 0 : Number(deletions),
					untracked: false,
					binary,
				},
			];
		}),

	/** A `-z` list of paths. */
	paths: (output: string) => output.split("\0").filter(Boolean),

	/** Lines in a file git has not seen, all of which count as added. */
	lines: (data: Uint8Array) => {
		// The same test git uses: a NUL in the first 8000 bytes.
		if (data.subarray(0, 8000).includes(0)) return null;
		let lines = 0;
		for (const byte of data) if (byte === 10) lines++;
		if (data.length && data[data.length - 1] !== 10) lines++;
		return lines;
	},
} as const;
