import type { ShellCapability } from "../../../core/types/capability.ts";
import { SnippetService } from "../../data/services/SnippetService.ts";
import {
	type FileCategory,
	FileExcludeUtils,
	type FileScope,
	type FileSkipReason,
} from "../utils/FileExcludeUtils.ts";
import { FileMatchUtils, type IgnoreRule } from "../utils/FileMatchUtils.ts";
import { PathUtils } from "../utils/PathUtils.ts";
import { FileExtractionService } from "./FileExtractionService.ts";

/**
 * FileSearchService — search that is safe to point at any directory.
 *
 * The three failure modes this exists to prevent, in order of how often they
 * bite an agent:
 *
 *   1. A hit inside a lockfile, bundle or generated module returns megabytes of
 *      noise. Every file is screened by name, size and content before it can
 *      contribute a single character (`FileExcludeUtils`), and `.gitignore` is
 *      honoured so a project's own idea of "not source" is respected.
 *   2. A common term matches ten thousand times. Results are capped per file
 *      and overall, and ranking counts distinct terms rather than raw hits.
 *   3. Traversal never ends. Walking is bounded by entries and depth, content
 *      reads are bounded by file count, and both report what they left out.
 *
 * How much is withheld is the caller's choice, not this file's: a walk takes a
 * `FileScope`, and only a text search asks for the strict one. Listing a tree
 * is answering "what is here", and an upload of screenshots is still an answer.
 *
 * Everything is expressed against the `ShellCapability` primitives, so the same
 * implementation serves the local filesystem and the virtual chat filesystem.
 */

/** Directory entries visited before a walk gives up. */
const MAX_WALK_ENTRIES = 20_000;

/** How deep a walk descends before treating the tree as pathological. */
const MAX_WALK_DEPTH = 24;

/** Files whose contents a single search will read. */
const MAX_SCANNED_FILES = 4_000;

/** Files read at once. Enough to hide latency, few enough to stay polite. */
const CONCURRENCY = 16;

/** Characters of snippet a single result may contribute. */
const MAX_RESULT_CHARS = 600;

/** Characters of snippet a whole result set may contribute. */
const MAX_TOTAL_CHARS = 8_000;

/** Share of the best result's score a file must reach to be worth reporting. */
const RELEVANCE_FLOOR = 0.25;

export interface FileSearchResult {
	path: string;
	/** Rendered, line-numbered excerpt. Always within the result budget. */
	snippet: string;
	/** Total matches in this file, of which the snippet shows the best few. */
	matches?: number;
}

export interface FileSearchStats {
	/** Files considered after name-based exclusion. */
	found: number;
	/** Files whose contents were read. */
	scanned: number;
	/** Files containing at least one match. */
	matched: number;
	/** Matches found, including those beyond the reported ones. */
	hits: number;
	skipped: Partial<Record<FileSkipReason, number>>;
	/** Set when caps stopped the search before it ran out of files. */
	truncated: boolean;
}

export interface FileSearchReport {
	results: FileSearchResult[];
	stats: FileSearchStats;
	/** One line of plain text describing coverage, for the model to read. */
	summary: string;
}

interface WalkEntry {
	path: string;
	is_dir: boolean;
	/**
	 * Set on a directory that was listed but not descended into, with the kind
	 * of directory it is. Nothing disappears from a tree without saying so.
	 */
	skipped?: FileCategory;
}

interface IgnoreScope {
	base: string;
	rules: IgnoreRule[];
}

const getRelative = PathUtils.relative;

/** Runs `run` over `items` with a bounded number of reads in flight. */
const mapPool = async <T, R>(
	items: T[],
	run: (item: T) => Promise<R>,
	concurrency = CONCURRENCY,
): Promise<R[]> => {
	const results: R[] = new Array(items.length);
	let cursor = 0;

	const worker = async () => {
		while (true) {
			const index = cursor++;
			if (index >= items.length) return;
			results[index] = await run(items[index]);
		}
	};

	await Promise.all(
		Array.from({ length: Math.min(concurrency, items.length) }, worker),
	);

	return results;
};

const getEmptyStats = (): FileSearchStats => ({
	found: 0,
	scanned: 0,
	matched: 0,
	hits: 0,
	skipped: {},
	truncated: false,
});

/**
 * Kinds of file that a text search will never open however it is phrased.
 * Worth naming when a search comes back empty, because the next move is a
 * different tool rather than a different query.
 */
const UNSEARCHABLE = [
	"media",
	"binary",
	"archive",
	"data",
] as const satisfies readonly FileSkipReason[];

const getSummary = ({
	stats,
	shown,
	advice,
}: {
	stats: FileSearchStats;
	shown: number;
	advice?: string;
}) => {
	const skipped = Object.entries(stats.skipped)
		.filter(([, count]) => count > 0)
		.map(([reason, count]) => `${count} ${reason}`)
		.join(", ");

	// Only when a search found nothing at all: a reader with results in hand
	// does not need to be told what was left out.
	const unsearchable = shown
		? 0
		: UNSEARCHABLE.reduce(
				(total, reason) => total + (stats.skipped[reason] ?? 0),
				0,
			);

	const parts = [
		`Searched ${stats.scanned} of ${stats.found} file(s)`,
		skipped ? `skipped ${skipped}` : null,
		`${stats.hits} match(es) in ${stats.matched} file(s)`,
		shown < stats.matched ? `showing the top ${shown}` : null,
		stats.truncated ? "search limits were reached" : null,
		shown < stats.matched || stats.truncated
			? (advice ?? "Narrow the query or pass `include` to see the rest.")
			: null,
		unsearchable
			? `${unsearchable} path(s) here hold no searchable text — use find_files to list them or read_file to open one`
			: null,
	].filter(Boolean);

	return `${parts.join(". ")}.`;
};

export const FileSearchService = {
	/**
	 * Lists files under `path`, skipping anything the scope excludes, anything
	 * `.gitignore` excludes when the scope honours it, and anything past the
	 * traversal caps.
	 *
	 * An excluded directory is still reported when directories are wanted — it
	 * is simply not descended into. A tree that quietly omits `node_modules`
	 * teaches the reader the wrong thing about the project; one that shows it
	 * unexpanded teaches the right one, at the cost of a single line.
	 */
	walk: async ({
		shell,
		path,
		scope = "search",
		includeDirectories = false,
		gitignore = scope === "search",
		maxEntries = MAX_WALK_ENTRIES,
		maxDepth = MAX_WALK_DEPTH,
	}: {
		shell: Pick<ShellCapability, "readDir"> &
			Partial<Pick<ShellCapability, "readFile">>;
		path: string;
		scope?: FileScope;
		includeDirectories?: boolean;
		gitignore?: boolean;
		maxEntries?: number;
		maxDepth?: number;
	}): Promise<{
		entries: WalkEntry[];
		truncated: boolean;
		skipped: Partial<Record<FileCategory, number>>;
	}> => {
		const pending: { path: string; depth: number; scopes: IgnoreScope[] }[] = [
			{ path, depth: 0, scopes: [] },
		];
		const entries: WalkEntry[] = [];
		const visited = new Set<string>();
		const skipped: Partial<Record<FileCategory, number>> = {};

		let truncated = false;
		let isRoot = true;

		while (pending.length) {
			const directory = pending.shift() as (typeof pending)[number];
			const normalized = PathUtils.normalize({
				path: directory.path,
				unix: true,
			});
			if (visited.has(normalized)) continue;
			visited.add(normalized);

			let listing: WalkEntry[];
			try {
				listing = await shell.readDir({ path: directory.path });
			} catch (error) {
				// A missing root is a real error; an unreadable subdirectory is not.
				if (isRoot) throw error;
				continue;
			}
			isRoot = false;

			let scopes = directory.scopes;
			if (gitignore && shell.readFile) {
				const rules = await FileSearchService.getIgnoreRules({
					shell: shell as Pick<ShellCapability, "readFile">,
					path: directory.path,
				});
				if (rules.length) scopes = [...scopes, { base: directory.path, rules }];
			}

			for (const entry of listing.sort((a, b) =>
				a.path.localeCompare(b.path),
			)) {
				if (entries.length >= maxEntries) {
					truncated = true;
					break;
				}

				const ignored = scopes.some((ignore) =>
					FileMatchUtils.isIgnored({
						rules: ignore.rules,
						path: getRelative({ base: ignore.base, path: entry.path }),
						isDirectory: entry.is_dir,
					}),
				);
				if (ignored) continue;

				// Judged from the search root down, so a project checked out into
				// a directory that happens to be called `build` is still searched.
				const excluded = FileExcludeUtils.getExcluded({
					path: entry.path,
					root: path,
					scope,
					isDirectory: entry.is_dir,
				});

				if (excluded) {
					skipped[excluded] = (skipped[excluded] ?? 0) + 1;
					if (!entry.is_dir || !includeDirectories) continue;
					entries.push({ ...entry, skipped: excluded });
					continue;
				}

				if (entry.is_dir) {
					if (directory.depth + 1 > maxDepth) truncated = true;
					else
						pending.push({
							path: entry.path,
							depth: directory.depth + 1,
							scopes,
						});
				}
				if (!entry.is_dir || includeDirectories) entries.push(entry);
			}

			if (entries.length >= maxEntries) {
				truncated = true;
				break;
			}
		}

		return { entries, truncated, skipped };
	},

	/** Reads and parses `<path>/.gitignore`, if there is one. */
	getIgnoreRules: async ({
		shell,
		path,
	}: {
		shell: Pick<ShellCapability, "readFile">;
		path: string;
	}): Promise<IgnoreRule[]> => {
		try {
			const file = await shell.readFile({
				path: `${path.replace(/[\\/]+$/, "")}/.gitignore`,
			});
			const content = new TextDecoder().decode(file.data);
			return FileMatchUtils.getRules({ content });
		} catch {
			return [];
		}
	},

	/**
	 * Reads a file and decides whether its contents may be searched. Returns the
	 * text, or the reason the file was passed over.
	 *
	 * A PDF, a Word document or a spreadsheet is unpacked here rather than
	 * turned away as binary. Someone who attaches a contract and asks which
	 * clause covers termination is asking about words that are in the file, and
	 * the only thing standing between the search and them is a container.
	 */
	readSearchable: async ({
		shell,
		path,
		root,
	}: {
		shell: Pick<ShellCapability, "readFile">;
		path: string;
		root?: string;
	}): Promise<{ reason: FileSkipReason | null; text?: string }> => {
		let data: Uint8Array;
		try {
			({ data } = await shell.readFile({ path }));
		} catch {
			return { reason: "unreadable" };
		}

		if (FileExtractionService.canExtract({ path })) {
			const excluded = FileExcludeUtils.getExcluded({ path, root });
			if (excluded) return { reason: excluded };
			// Documents are compressed, so the byte budget that bounds a text
			// file says nothing useful about how much prose is inside one.
			if (data.length > FileExtractionService.maxBytes)
				return { reason: "large" };

			const text = await FileExtractionService.extract({ data, path });
			return text === null ? { reason: "unreadable" } : { reason: null, text };
		}

		return FileExcludeUtils.getSkipReason({ path, root, data });
	},

	/**
	 * Regular-expression search over file contents, reported as numbered lines
	 * the way `grep -n` would. Smart case by default: an all-lowercase query is
	 * case-insensitive, a query with any capital is not.
	 */
	grep: async ({
		shell,
		path,
		query,
		literal = false,
		caseSensitive,
		include,
		context = 0,
		maxResults = 10,
		maxMatchesPerFile = 5,
	}: {
		shell: Pick<ShellCapability, "readDir" | "readFile">;
		path: string;
		query: string;
		literal?: boolean;
		caseSensitive?: boolean;
		include?: string;
		context?: number;
		maxResults?: number;
		maxMatchesPerFile?: number;
	}): Promise<FileSearchReport> => {
		if (!query.trim()) throw new Error("Search query must not be empty.");

		const source = literal
			? query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
			: query;
		const flags = `g${(caseSensitive ?? /[A-Z]/.test(query)) ? "" : "i"}`;

		let pattern: RegExp;
		try {
			pattern = new RegExp(source, flags);
		} catch (error) {
			throw new Error(
				`Invalid regular expression: ${error instanceof Error ? error.message : String(error)}. Set literal to true to search for the text as written.`,
			);
		}

		const { candidates, stats } = await FileSearchService.getCandidates({
			shell,
			path,
			include,
		});

		const results: FileSearchResult[] = [];
		let characters = 0;

		// Scanning stops once the reported set is full: counting every match in a
		// repository costs far more than it tells the reader.
		for (let index = 0; index < candidates.length; index += CONCURRENCY) {
			if (results.length >= maxResults) {
				stats.truncated = stats.truncated || index < candidates.length;
				break;
			}

			const batch = candidates.slice(index, index + CONCURRENCY);
			const read = await mapPool(batch, async (candidate) => ({
				path: candidate,
				...(await FileSearchService.readSearchable({
					shell,
					path: candidate,
					root: path,
				})),
			}));

			for (const file of read) {
				if (file.reason || file.text === undefined) {
					stats.skipped[file.reason ?? "unreadable"] =
						(stats.skipped[file.reason ?? "unreadable"] ?? 0) + 1;
					continue;
				}
				stats.scanned++;

				const lines = file.text.split("\n");
				const matches: { number: number; text: string }[] = [];
				let hits = 0;

				for (let number = 1; number <= lines.length; number++) {
					pattern.lastIndex = 0;
					if (!pattern.test(lines[number - 1])) continue;
					hits++;
					if (matches.length < maxMatchesPerFile)
						matches.push({ number, text: lines[number - 1] });
				}

				if (!hits) continue;

				stats.matched++;
				stats.hits += hits;

				if (results.length >= maxResults || characters >= MAX_TOTAL_CHARS) {
					stats.truncated = true;
					continue;
				}

				const snippet = SnippetService.getExcerpt({
					text: file.text,
					query,
					lines: matches,
					context,
					maxGroups: maxMatchesPerFile,
					maxChars: Math.min(
						MAX_RESULT_CHARS,
						Math.max(120, MAX_TOTAL_CHARS - characters),
					),
				});
				characters += snippet.length;
				results.push({ path: file.path, snippet, matches: hits });
			}
		}

		return {
			results,
			stats,
			summary: getSummary({
				stats,
				shown: results.length,
				advice:
					"Narrow the pattern, pass `include` to filter by path, or raise max_results.",
			}),
		};
	},

	/**
	 * Relevance search across names and contents, for when the exact spelling of
	 * a symbol is unknown.
	 *
	 * Ranking is BM25-shaped: a term is worth more the fewer files contain it,
	 * and repetition inside one file saturates quickly. That is what makes a
	 * natural-language query work — "how are messages compacted" is carried by
	 * `compacted`, not by `messages`, and the ranking discovers which is which
	 * from the corpus in front of it rather than from a hand-written list.
	 */
	search: async ({
		shell,
		path,
		query,
		include,
		maxResults = 10,
	}: {
		shell: Pick<ShellCapability, "readDir" | "readFile">;
		path: string;
		query: string;
		include?: string;
		maxResults?: number;
	}): Promise<FileSearchReport> => {
		if (!query.trim()) throw new Error("Search query must not be empty.");

		const { candidates, stats } = await FileSearchService.getCandidates({
			shell,
			path,
			include,
		});

		const terms = SnippetService.getTerms({ query });

		const documents = await mapPool(candidates, async (candidate) => {
			const relative = getRelative({ base: path, path: candidate });
			const file = await FileSearchService.readSearchable({
				shell,
				path: candidate,
				root: path,
			});
			return {
				path: candidate,
				text: file.text,
				reason: file.reason,
				name: SnippetService.getCounts({ text: relative, terms }),
				body: file.text
					? SnippetService.getCounts({ text: file.text, terms })
					: new Map(),
			};
		});

		// How many files contain each term at all — the corpus statistic that
		// separates a distinctive word from a ubiquitous one.
		const frequencies = new Map<string, number>();
		for (const document of documents) {
			if (document.reason) {
				stats.skipped[document.reason] =
					(stats.skipped[document.reason] ?? 0) + 1;
			} else {
				stats.scanned++;
			}
			for (const term of terms) {
				if (!document.body.has(term.value) && !document.name.has(term.value))
					continue;
				frequencies.set(term.value, (frequencies.get(term.value) ?? 0) + 1);
			}
		}

		const total = Math.max(1, documents.length);
		const weights = new Map(
			terms.map((term) => {
				const frequency = frequencies.get(term.value) ?? 0;
				const rarity = Math.log(
					1 + (total - frequency + 0.5) / (frequency + 0.5),
				);
				return [term.value, term.weight * rarity];
			}),
		);

		const scored: {
			path: string;
			text?: string;
			score: number;
			hits: number;
		}[] = [];

		for (const document of documents) {
			let score = 0;
			let hits = 0;
			let matched = 0;

			for (const term of terms) {
				const weight = weights.get(term.value) ?? 0;
				const body = document.body.get(term.value);
				const name = document.name.get(term.value);
				if (!body && !name) continue;

				matched++;
				hits += body?.count ?? 0;

				if (body) {
					score +=
						weight *
						SnippetService.getFrequency({ count: body.count }) *
						(body.words ? 1.5 : 1);
				}
				// A path match is a strong, cheap signal: files are usually named
				// after what they do.
				if (name) score += weight * 3;
			}

			if (!score) continue;
			// Answering the whole question beats answering part of it.
			if (matched === terms.length && terms.length > 1) score *= 1.5;

			stats.matched++;
			stats.hits += hits;
			scored.push({
				path: document.path,
				text: document.text,
				score,
				hits,
			});
		}

		scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

		// A long tail of files sharing one common term is noise, however many
		// there are. Anything far below the best hit is not worth the context.
		const floor = (scored[0]?.score ?? 0) * RELEVANCE_FLOOR;
		const top = scored
			.filter((entry) => entry.score >= floor)
			.slice(0, maxResults);

		// Excerpts are centred on the terms that made a file rank, not on the
		// common ones it happens to share with everything else.
		const distinctive =
			[...weights.entries()]
				.sort((a, b) => b[1] - a[1])
				.slice(0, 3)
				.map(([term]) => term)
				.join(" ") || query;

		const results: FileSearchResult[] = [];
		let characters = 0;

		for (const entry of top) {
			const snippet = entry.text
				? SnippetService.getExcerpt({
						text: entry.text,
						query: distinctive,
						maxGroups: 3,
						maxChars: Math.min(
							MAX_RESULT_CHARS,
							Math.max(120, MAX_TOTAL_CHARS - characters),
						),
					})
				: "";
			characters += snippet.length;
			results.push({
				path: entry.path,
				snippet,
				matches: entry.hits || undefined,
			});
		}

		return {
			results,
			stats,
			summary: getSummary({
				stats,
				shown: results.length,
				advice:
					"Use grep_files for an exact pattern, or pass `include` to filter by path.",
			}),
		};
	},

	/**
	 * Paths matching a glob, without reading any contents. The cheap way to
	 * answer "where does this kind of file live".
	 *
	 * This is the one search that must not filter by kind. An attached upload
	 * is reached by globbing the directory it was mounted at, and a run of
	 * screenshots or logs that the user deliberately sent is exactly what the
	 * glob is looking for. Only the trees nobody meant to send are withheld.
	 */
	glob: async ({
		shell,
		path,
		pattern,
		scope = "listing",
		maxResults = 100,
	}: {
		shell: Pick<ShellCapability, "readDir" | "readFile">;
		path: string;
		pattern: string;
		scope?: FileScope;
		maxResults?: number;
	}): Promise<{
		paths: string[];
		truncated: boolean;
		/** Paths the glob was tested against, so an empty result can be read. */
		scanned: number;
	}> => {
		const { entries, truncated } = await FileSearchService.walk({
			shell,
			path,
			scope,
		});
		const paths = entries
			.filter((entry) =>
				FileMatchUtils.matches({
					pattern,
					path: getRelative({ base: path, path: entry.path }),
				}),
			)
			.map((entry) => entry.path);

		return {
			paths: paths.slice(0, maxResults),
			truncated: truncated || paths.length > maxResults,
			scanned: entries.length,
		};
	},

	/** Shared first half of every search: walk, filter, and cap. */
	getCandidates: async ({
		shell,
		path,
		include,
		maxFiles = MAX_SCANNED_FILES,
	}: {
		shell: Pick<ShellCapability, "readDir" | "readFile">;
		path: string;
		include?: string;
		maxFiles?: number;
	}): Promise<{ candidates: string[]; stats: FileSearchStats }> => {
		const stats = getEmptyStats();
		const { entries, truncated, skipped } = await FileSearchService.walk({
			shell,
			path,
			scope: "search",
		});
		stats.truncated = truncated;
		// What the walk turned away by name counts as skipped too, or a summary
		// would claim full coverage of a directory it barely looked at.
		stats.skipped = { ...skipped };

		let candidates = entries.map((entry) => entry.path);

		if (include) {
			candidates = candidates.filter((candidate) =>
				FileMatchUtils.matches({
					pattern: include,
					path: getRelative({ base: path, path: candidate }),
				}),
			);
		}

		stats.found = candidates.length;

		if (candidates.length > maxFiles) {
			candidates = candidates.slice(0, maxFiles);
			stats.truncated = true;
		}

		return { candidates, stats };
	},
} as const;
