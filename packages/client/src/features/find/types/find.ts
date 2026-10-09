/**
 * Text drawn as one piece by the runtime: a DOM text node in the app, a block
 * of text in the CLI. `node` is whatever the runtime needs to find it again.
 */
export interface FindPiece<N> {
	node: N;
	text: string;
}

/**
 * A run of text that reads as one — a paragraph, a block of code — and that a
 * match may span, across as many of its pieces as it takes. Matches never
 * cross from one block into the next, as a browser's never cross paragraphs.
 */
export type FindBlock<N> = FindPiece<N>[];

/** Where a match starts or ends: an offset into one piece's text. */
export interface FindPoint<N> {
	node: N;
	offset: number;
}

/** A match of the query, handed back in the runtime's own nodes. */
export interface FindMatch<N> {
	start: FindPoint<N>;
	end: FindPoint<N>;
	/**
	 * Every piece the match covers, with the part of its text that is matched,
	 * for a runtime that highlights piece by piece.
	 */
	pieces: { node: N; start: number; end: number }[];
}

export interface FindOptions {
	caseSensitive?: boolean;
	/** Beyond this many a search stops counting, as browsers' own find bars do. */
	limit?: number;
}

/**
 * What a runtime gives find in page: the text it draws, and a way to show a
 * match. Highlighting goes back through the matches `useFind` returns.
 */
export interface FindAdapter<N> {
	/** The text to search, in reading order, read afresh on every search. */
	blocks: () => Iterable<FindBlock<N>>;
	/** Brings a match into view as it becomes the current one. */
	reveal?: (match: FindMatch<N>) => void;
}
