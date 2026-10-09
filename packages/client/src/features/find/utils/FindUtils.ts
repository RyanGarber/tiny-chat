import type {
	FindBlock,
	FindMatch,
	FindOptions,
	FindPoint,
} from "#client/features/find/types/find.ts";

const DEFAULT_LIMIT = 1000;

/** Escapes everything a `u` pattern treats as syntax. */
const escapePattern = (text: string) =>
	text.replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&");

export const FindUtils = {
	/**
	 * Every non-overlapping match of `query` in `blocks`, in reading order.
	 *
	 * Each block is searched as the text of its pieces joined together, so a
	 * match reaches across however the runtime happened to split it up — a word
	 * in a link, or code split into tokens by its highlighting.
	 */
	search: <N>(
		blocks: Iterable<FindBlock<N>>,
		query: string,
		{ caseSensitive = false, limit = DEFAULT_LIMIT }: FindOptions = {},
	): FindMatch<N>[] => {
		if (!query) return [];
		// Matched with a pattern rather than by lowercasing both sides, which
		// can change a string's length and so every offset after it.
		const pattern = new RegExp(
			escapePattern(query),
			caseSensitive ? "gu" : "giu",
		);
		const matches: FindMatch<N>[] = [];

		for (const block of blocks) {
			if (!block.length) continue;
			const text = block.map((piece) => piece.text).join("");
			const starts: number[] = [];
			let offset = 0;
			for (const piece of block) {
				starts.push(offset);
				offset += piece.text.length;
			}

			for (const found of text.matchAll(pattern)) {
				const from = found.index;
				const to = from + found[0].length;
				const pieces: FindMatch<N>["pieces"] = [];
				block.forEach((piece, i) => {
					const start = Math.max(from, starts[i]) - starts[i];
					const end = Math.min(to, starts[i] + piece.text.length) - starts[i];
					if (start < end) pieces.push({ node: piece.node, start, end });
				});
				const first = pieces[0];
				const last = pieces[pieces.length - 1];
				const start: FindPoint<N> = { node: first.node, offset: first.start };
				const end: FindPoint<N> = { node: last.node, offset: last.end };
				matches.push({ start, end, pieces });
				if (matches.length >= limit) return matches;
			}
		}

		return matches;
	},

	/** Whether two matches cover the same text of the same nodes. */
	isEqual: <N>(a: FindMatch<N>, b: FindMatch<N>) =>
		a.pieces.length === b.pieces.length &&
		a.pieces.every(
			(piece, i) =>
				piece.node === b.pieces[i].node &&
				piece.start === b.pieces[i].start &&
				piece.end === b.pieces[i].end,
		),
} as const;
