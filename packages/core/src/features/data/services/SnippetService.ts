/**
 * SnippetService — bounded excerpting and relevance scoring for arbitrary text.
 *
 * Two shapes of output and one scoring model:
 *
 *   `getSnippet`  a single short excerpt for prose (chat search, spotlight).
 *   `getExcerpt`  numbered line groups for code (file search, grep).
 *   `getScore` / `getCounts`  how well a document answers a query, for ranking.
 *
 * Every entry point takes a hard character budget and never exceeds it. That
 * guarantee is the point: a match inside a 4 MB bundle costs the same context
 * as a match inside a 40-line module, so one unlucky file can never flood an
 * agent's window.
 *
 * Scoring counts *distinct query terms* first and raw hits only logarithmically,
 * so a generated file repeating a term ten thousand times cannot outrank the
 * source file that actually defines it.
 */

/** Text past this length is scanned for hits but never scored line by line. */
const MAX_SCAN_CHARS = 2_000_000;

/** Hits collected per term before scanning stops; only ranking needs the tail. */
const MAX_HITS_PER_TERM = 500;

export interface SnippetLine {
	/** 1-based line number, as an editor would show it. */
	number: number;
	text: string;
}

export interface SnippetCount {
	/** Occurrences of the term. */
	count: number;
	/** Occurrences that sat on a word boundary rather than inside another word. */
	words: number;
}

export interface SnippetScore {
	/** How many distinct query terms appear at all. */
	terms: number;
	/** Total occurrences, across every term. */
	hits: number;
	/** Combined ranking score; comparable across documents of any size. */
	score: number;
}

export interface SnippetTerm {
	value: string;
	/** Longer, more specific terms carry more signal than short ones. */
	weight: number;
}

/** Whether the character at `index` starts or ends a word. */
const isBoundary = (text: string, index: number) =>
	index < 0 || index >= text.length || !/[\p{L}\p{N}_]/u.test(text[index]);

export const SnippetService = {
	/**
	 * A single bounded excerpt centred on the densest run of query terms.
	 * Falls back to the head of the text when nothing matches.
	 */
	getSnippet: ({
		text,
		query,
		maxChars = 240,
	}: {
		text: string;
		query: string;
		maxChars?: number;
	}): string => {
		if (!text) return "";
		if (text.length <= maxChars) return text;

		const terms = SnippetService.getTerms({ query });
		const hits = SnippetService.getHits({ text, terms });

		if (!hits.length) return SnippetService.getHead({ text, maxChars });

		const [start, end] = SnippetService.getWindow({
			text,
			hits,
			maxChars,
		});

		const excerpt = text.slice(start, end).replace(/\s+/g, " ").trim();
		if (!excerpt) return SnippetService.getHead({ text, maxChars });

		return `${start > 0 ? "…" : ""}${excerpt}${end < text.length ? "…" : ""}`;
	},

	/**
	 * Numbered line groups around the best matches, the way a code search result
	 * reads. Groups are separated by a `…` line so the model can see that lines
	 * were skipped between them.
	 */
	getExcerpt: ({
		text,
		query,
		lines: providedLines,
		maxGroups = 3,
		maxChars = 800,
		context = 1,
		maxLineChars = 300,
	}: {
		text: string;
		query: string;
		/** Pre-computed match lines; when omitted they are found from `query`. */
		lines?: SnippetLine[];
		maxGroups?: number;
		maxChars?: number;
		context?: number;
		maxLineChars?: number;
	}): string => {
		const all = text.split("\n");
		const matches =
			providedLines ??
			SnippetService.getLines({ text, query, maxLines: maxGroups });

		if (!matches.length) {
			return SnippetService.getSnippet({ text, query, maxChars });
		}

		// Merge nearby matches into groups so context lines are not repeated.
		const groups: [number, number][] = [];
		for (const { number } of matches) {
			const start = Math.max(1, number - context);
			const end = Math.min(all.length, number + context);
			const last = groups.at(-1);
			if (last && start <= last[1] + 1) last[1] = Math.max(last[1], end);
			else groups.push([start, end]);
			if (groups.length >= maxGroups) break;
		}

		const rendered: string[] = [];
		let used = 0;

		for (const [start, end] of groups) {
			for (let number = start; number <= end; number++) {
				const line = SnippetService.getLine({
					text: all[number - 1] ?? "",
					maxChars: maxLineChars,
				});
				const entry = line ? `${number}: ${line}` : `${number}:`;
				if (used + entry.length > maxChars) {
					return `${rendered.join("\n")}\n…`.trim();
				}
				rendered.push(entry);
				used += entry.length + 1;
			}
			if (end < all.length) {
				rendered.push("…");
				used += 2;
			}
		}

		// A trailing separator adds nothing when the excerpt ends the file.
		if (rendered.at(-1) === "…") rendered.pop();

		return rendered.join("\n");
	},

	/**
	 * The best matching lines, highest scoring first, returned in file order.
	 * Used directly by grep-style searches that want line numbers.
	 */
	getLines: ({
		text,
		query,
		maxLines = 5,
		minScore = 1,
	}: {
		text: string;
		query: string;
		maxLines?: number;
		minScore?: number;
	}): SnippetLine[] => {
		const terms = SnippetService.getTerms({ query });
		if (!terms.length) return [];

		const lines = text.split("\n");
		const scored: { number: number; text: string; score: number }[] = [];

		for (let index = 0; index < lines.length; index++) {
			const line = lines[index];
			if (!line.trim()) continue;
			const lower = line.toLowerCase();

			let score = 0;
			for (const term of terms) {
				const at = lower.indexOf(term.value);
				if (at === -1) continue;
				score += term.weight;
				// An identifier match beats an incidental substring.
				if (
					isBoundary(lower, at - 1) &&
					isBoundary(lower, at + term.value.length)
				)
					score += term.weight;
			}
			if (score < minScore) continue;

			scored.push({ number: index + 1, text: line, score });
		}

		return scored
			.sort((a, b) => b.score - a.score || a.number - b.number)
			.slice(0, maxLines)
			.sort((a, b) => a.number - b.number)
			.map(({ number, text: value }) => ({ number, text: value }));
	},

	/**
	 * Occurrences of each term in a document, and how many of them fell on a
	 * word boundary. The raw material for ranking across a corpus.
	 */
	getCounts: ({
		text,
		terms,
	}: {
		text: string;
		terms: SnippetTerm[];
	}): Map<string, SnippetCount> => {
		const lower = text.slice(0, MAX_SCAN_CHARS).toLowerCase();
		const counts = new Map<string, SnippetCount>();

		for (const term of terms) {
			let count = 0;
			let words = 0;
			let from = 0;
			while (count < MAX_HITS_PER_TERM) {
				const at = lower.indexOf(term.value, from);
				if (at === -1) break;
				count++;
				if (
					isBoundary(lower, at - 1) &&
					isBoundary(lower, at + term.value.length)
				)
					words++;
				from = at + term.value.length;
			}
			if (count) counts.set(term.value, { count, words });
		}

		return counts;
	},

	/**
	 * What a term occurring `count` times is worth. Saturating rather than
	 * linear: the difference between one occurrence and five means something,
	 * the difference between a hundred and a thousand does not.
	 */
	getFrequency: ({ count }: { count: number }): number => count / (count + 1.2),

	/**
	 * Ranking score for a document with no corpus to compare it against.
	 * Distinct terms dominate and repetition saturates, so a file that repeats
	 * one term cannot outrank the file that defines the thing being looked for.
	 */
	getScore: ({
		text,
		query,
	}: {
		text: string;
		query: string;
	}): SnippetScore => {
		const terms = SnippetService.getTerms({ query });
		if (!terms.length) return { terms: 0, hits: 0, score: 0 };

		const counts = SnippetService.getCounts({ text, terms });

		let hits = 0;
		let score = 0;

		for (const term of terms) {
			const found = counts.get(term.value);
			if (!found) continue;
			hits += found.count;
			score +=
				term.weight * (10 + Math.log2(1 + found.count) + (found.words ? 5 : 0));
		}

		// Matching every term is the strongest signal a keyword search can give.
		if (counts.size === terms.length && terms.length > 1) score *= 1.5;

		return { terms: counts.size, hits, score };
	},

	/**
	 * Query terms with their weights. Stop words are dropped unless the query is
	 * nothing but stop words, and identifiers are split so `getUserById` also
	 * matches `get_user_by_id`.
	 */
	getTerms: ({ query }: { query: string }): SnippetTerm[] => {
		const seen = new Map<string, SnippetTerm>();

		const add = (value: string, weight: number) => {
			if (value.length < 2) return;
			const existing = seen.get(value);
			if (!existing || existing.weight < weight)
				seen.set(value, { value, weight });
		};

		const raw = query
			.split(/[\s\-_/\\.,;:!?'"()[\]{}<>|@#$%^&*+=~`]+/)
			.filter(Boolean);

		const words = raw.filter(
			(word) => !SnippetService.stopWords.has(word.toLowerCase()),
		);

		for (const term of words.length ? words : raw) {
			add(term.toLowerCase(), Math.min(3, 1 + term.length / 8));
			// camelCase and PascalCase pieces, so a query can match either style.
			const pieces = term.split(/(?<=[a-z0-9])(?=[A-Z])/);
			if (pieces.length > 1)
				for (const piece of pieces) add(piece.toLowerCase(), 0.5);
		}

		// The whole query as a phrase outweighs any single term when present.
		const phrase = query.trim().toLowerCase();
		if (phrase.length > 2 && seen.size > 1) add(phrase, 4);

		return [...seen.values()];
	},

	/** Character offsets of every term occurrence, bounded per term. */
	getHits: ({
		text,
		terms,
	}: {
		text: string;
		terms: SnippetTerm[];
	}): number[] => {
		const lower = text.slice(0, MAX_SCAN_CHARS).toLowerCase();
		const hits: number[] = [];

		for (const term of terms) {
			let count = 0;
			let from = 0;
			while (count < MAX_HITS_PER_TERM) {
				const at = lower.indexOf(term.value, from);
				if (at === -1) break;
				hits.push(at);
				count++;
				from = at + term.value.length;
			}
		}

		return hits.sort((a, b) => a - b);
	},

	/**
	 * The `maxChars`-wide window containing the most hits, snapped outward to
	 * word boundaries. Linear in the number of hits.
	 */
	getWindow: ({
		text,
		hits,
		maxChars,
	}: {
		text: string;
		hits: number[];
		maxChars: number;
	}): [number, number] => {
		let best = { index: 0, count: 0 };

		for (let index = 0; index < hits.length; index++) {
			let count = 0;
			while (
				index + count < hits.length &&
				hits[index + count] - hits[index] < maxChars
			)
				count++;
			if (count > best.count) best = { index, count };
		}

		const first = hits[best.index] ?? 0;
		const last = hits[best.index + best.count - 1] ?? first;
		const centre = Math.floor((first + last) / 2);

		let start = Math.max(0, centre - Math.floor(maxChars / 2));
		let end = Math.min(text.length, start + maxChars);
		start = Math.max(0, end - maxChars);

		// Snap inward to a word boundary so the excerpt does not start mid-token.
		if (start > 0) {
			const space = text.indexOf(" ", start);
			if (space !== -1 && space < start + 20 && space < first)
				start = space + 1;
		}
		if (end < text.length) {
			const space = text.lastIndexOf(" ", end);
			if (space > last && space > start) end = space;
		}

		return [start, end];
	},

	/** Head of the text, cut at a word boundary. */
	getHead: ({ text, maxChars }: { text: string; maxChars: number }): string => {
		const collapsed = text.replace(/\s+/g, " ").trim();
		if (collapsed.length <= maxChars) return collapsed;
		const cut = collapsed.lastIndexOf(" ", maxChars);
		return `${collapsed.slice(0, cut > maxChars / 2 ? cut : maxChars)}…`;
	},

	/** One line, trimmed of trailing space and cut to a budget. */
	getLine: ({ text, maxChars }: { text: string; maxChars: number }): string => {
		const value = text.replace(/\s+$/, "");
		if (value.length <= maxChars) return value;
		return `${value.slice(0, maxChars)}… [${value.length - maxChars} more chars]`;
	},

	stopWords: new Set([
		"a",
		"an",
		"the",
		"and",
		"or",
		"but",
		"in",
		"on",
		"at",
		"to",
		"for",
		"of",
		"with",
		"by",
		"from",
		"as",
		"is",
		"was",
		"are",
		"were",
		"be",
		"been",
		"being",
		"have",
		"has",
		"had",
		"do",
		"does",
		"did",
		"will",
		"would",
		"could",
		"should",
		"may",
		"might",
		"shall",
		"can",
		"not",
		"no",
		"it",
		"its",
		"this",
		"that",
		"these",
		"those",
		"i",
		"you",
		"he",
		"she",
		"we",
		"they",
		"what",
		"which",
		"who",
		"how",
		"when",
		"where",
		"why",
		"if",
		"then",
		"so",
		"just",
		"about",
	]),
} as const;
