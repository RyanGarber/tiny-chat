import type { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

/** Columns a tab is expanded to when rendering text. */
const TAB_SIZE = 2;

/** Directories read at once while walking a tree. */
const WALK_CONCURRENCY = 32;

/** Escape sequences and control characters, except tab and newline. */
const CONTROL_REGEX =
	// biome-ignore lint/suspicious/noControlCharactersInRegex: terminal hell
	/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[[\]][0-?]*[ -/]*[@-~]|\x1b[@-Z\\-_]|[\x00-\x08\x0b-\x1f\x7f]/g;

export const CliUtils = {
	/** Remove terminal formatting and control sequences without changing text layout. */
	plain: (value: string) => value.replace(CONTROL_REGEX, ""),

	/**
	 * Prepares arbitrary text (file contents, command output) for rendering.
	 *
	 * Ink measures text with `string-width`, which counts a tab as zero columns,
	 * but writes it to the terminal verbatim, where it advances to the next tab
	 * stop. The line then draws wider than Ink laid it out, so it wraps at a
	 * column Ink does not know about and the rest of the frame stops lining up.
	 * Other control characters (and escape sequences embedded in tool output)
	 * cause the same mismatch, on top of being able to move the cursor.
	 *
	 * Expanding tabs here — before Ink measures anything — keeps what the
	 * terminal draws exactly as wide as what Ink measured.
	 *
	 * @param column Column the text starts at, so tab stops line up under any
	 * 	prefix (a diff marker, for example) rendered before it.
	 */
	display: (value: string, column = 0) =>
		value
			.split("\n")
			.map((line) => CliUtils.expandTabs(CliUtils.plain(line), column))
			.join("\n"),

	/**
	 * Replaces tabs in a single line with spaces up to the next tab stop.
	 */
	expandTabs: (line: string, column = 0) => {
		if (!line.includes("\t")) return line;

		const segments = line.split("\t");

		let expanded = "";
		let width = column;

		for (const [index, segment] of segments.entries()) {
			expanded += segment;
			width += [...segment].length;

			if (index === segments.length - 1) continue;

			const spaces = TAB_SIZE - (width % TAB_SIZE);
			expanded += " ".repeat(spaces);
			width += spaces;
		}

		return expanded;
	},

	/**
	 * Resolve one or more paths to an absolute one, accounting for common OS variables.
	 */
	/**
	 * `ShellCapability.walk`: breadth-first, one level at a time, with each
	 * level's directories read concurrently. Order is the same as reading them
	 * one by one — each directory's entries sorted, directories in the order
	 * they were found.
	 */
	walk: async ({
		path,
		maxDepth,
		maxEntries,
		prune,
	}: {
		path: string;
		maxDepth: number;
		maxEntries: number;
		prune: string[];
	}) => {
		const pruned = new Set(prune);
		const entries: { path: string; is_dir: boolean }[] = [];
		let truncated = false;

		// A missing root is a real error; an unreadable subdirectory is not.
		let level: { path: string; listing: Dirent[] }[] = [
			{ path, listing: await readdir(path, { withFileTypes: true }) },
		];

		for (let depth = 0; level.length; depth++) {
			const next: string[] = [];

			for (const directory of level) {
				const listing = directory.listing
					.map((entry) => ({
						path: join(directory.path, entry.name),
						name: entry.name,
						is_dir: entry.isDirectory(),
					}))
					.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

				for (const entry of listing) {
					if (entries.length >= maxEntries)
						return { root: path, entries, truncated: true };

					entries.push({ path: entry.path, is_dir: entry.is_dir });
					if (!entry.is_dir || pruned.has(entry.name.toLowerCase())) continue;
					if (depth + 1 > maxDepth) truncated = true;
					else next.push(entry.path);
				}
			}

			level = [];
			for (let index = 0; index < next.length; index += WALK_CONCURRENCY) {
				const batch = await Promise.all(
					next.slice(index, index + WALK_CONCURRENCY).map(async (path) => ({
						path,
						listing: await readdir(path, { withFileTypes: true }).catch(
							() => [] as Dirent[],
						),
					})),
				);
				level.push(...batch);
			}
		}

		return { root: path, entries, truncated };
	},

	resolve: (...paths: string[]) => {
		return resolve(
			...paths.map((path) => path.replace(/(^~[^/]*|%HOMEPATH%)/, homedir())),
		);
	},
} as const;
