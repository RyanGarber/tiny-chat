import { PathUtils } from "./PathUtils.ts";

export interface IgnoreRule {
	/** Compiled form of the pattern, tested against a normalized relative path. */
	pattern: RegExp;
	/** `!pattern` re-includes a path an earlier rule excluded. */
	negated: boolean;
	/** `pattern/` only ever matches directories. */
	directoryOnly: boolean;
}

/**
 * Translates one glob segment-set into a regular expression source.
 *
 * Supported, in gitignore/`.dockerignore`/shell order of familiarity:
 *   `*`      any run of characters inside a single segment
 *   `**`     any run of characters across segments
 *   `?`      one character inside a segment
 *   `[abc]`  a character class, `[!abc]` its negation
 *   `{a,b}`  alternation
 */
const getSource = (pattern: string): string => {
	let source = "";
	let index = 0;

	while (index < pattern.length) {
		const character = pattern[index];

		if (character === "*") {
			const isDouble = pattern[index + 1] === "*";
			if (isDouble) {
				const trailing = pattern[index + 2] === "/";
				// `**/` may match zero segments, so the slash is part of the group.
				source += trailing ? "(?:[^/]*(?:/|$))*" : "[\\s\\S]*";
				index += trailing ? 3 : 2;
			} else {
				source += "[^/]*";
				index += 1;
			}
			continue;
		}

		if (character === "?") {
			source += "[^/]";
			index += 1;
			continue;
		}

		if (character === "[") {
			const end = pattern.indexOf("]", index + 1);
			if (end === -1) {
				source += "\\[";
				index += 1;
				continue;
			}
			const body = pattern.slice(index + 1, end);
			source += `[${body.startsWith("!") ? `^${body.slice(1)}` : body}]`;
			index = end + 1;
			continue;
		}

		if (character === "{") {
			const end = pattern.indexOf("}", index + 1);
			if (end === -1) {
				source += "\\{";
				index += 1;
				continue;
			}
			const options = pattern.slice(index + 1, end).split(",");
			source += `(?:${options.map(getSource).join("|")})`;
			index = end + 1;
			continue;
		}

		source += character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		index += 1;
	}

	return source;
};

export const FileMatchUtils = {
	/** Compiles a glob into an anchored, case-insensitive regular expression. */
	toRegExp: ({ pattern }: { pattern: string }): RegExp =>
		new RegExp(`^${getSource(pattern)}$`, "i"),

	/**
	 * Matches a path against a glob the way a developer expects when typing one
	 * into a search box: a bare `*.ts` matches at any depth, while `src/*.ts`
	 * is anchored to the search root.
	 */
	matches: ({ pattern, path }: { pattern: string; path: string }): boolean => {
		const normalized = PathUtils.normalize({ path, unix: true }).replace(
			/^\.?\//,
			"",
		);
		if (FileMatchUtils.toRegExp({ pattern }).test(normalized)) return true;
		if (pattern.includes("/")) return false;
		// An unanchored pattern applies to the file name alone.
		return FileMatchUtils.toRegExp({ pattern }).test(
			PathUtils.name(normalized),
		);
	},

	/** Parses the contents of a `.gitignore`-style file into rules. */
	getRules: ({ content }: { content: string }): IgnoreRule[] => {
		const rules: IgnoreRule[] = [];

		for (const line of content.split(/\r?\n/)) {
			let pattern = line.trim();
			if (!pattern || pattern.startsWith("#")) continue;

			const negated = pattern.startsWith("!");
			if (negated) pattern = pattern.slice(1);

			const directoryOnly = pattern.endsWith("/");
			if (directoryOnly) pattern = pattern.slice(0, -1);
			if (!pattern) continue;

			// A pattern with an interior slash is anchored to the ignore file's
			// directory; anything else matches at any depth below it.
			const anchored = pattern.slice(0, -1).includes("/");
			if (pattern.startsWith("/")) pattern = pattern.slice(1);

			const source = getSource(pattern);
			rules.push({
				pattern: new RegExp(
					`^${anchored ? "" : "(?:[\\s\\S]*/)?"}${source}(?:/[\\s\\S]*)?$`,
				),
				negated,
				directoryOnly,
			});
		}

		return rules;
	},

	/**
	 * Applies gitignore rules to a path relative to the directory the rules came
	 * from. The last matching rule wins, which is what makes `!` work.
	 */
	isIgnored: ({
		rules,
		path,
		isDirectory,
	}: {
		rules: IgnoreRule[];
		path: string;
		isDirectory: boolean;
	}): boolean => {
		let ignored = false;
		for (const rule of rules) {
			// Directory-only rules are enforced while descending, so a file never
			// matches one directly — its parent was skipped first.
			if (rule.directoryOnly && !isDirectory) continue;
			if (!rule.pattern.test(path)) continue;
			ignored = !rule.negated;
		}
		return ignored;
	},
} as const;
