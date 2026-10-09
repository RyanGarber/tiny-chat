import { useRef, useState } from "react";
import type {
	FindAdapter,
	FindMatch,
	FindOptions,
} from "#client/features/find/types/find.ts";
import { FindUtils } from "#client/features/find/utils/FindUtils.ts";

/** An index kept within a list that may have shrunk under it. */
const clamp = (index: number, list: unknown[]) =>
	Math.max(0, Math.min(index, list.length - 1));

/**
 * Find in page, the same in the app and the CLI: the query, its matches, and
 * the one of them that is current, stepped through forward and back with
 * wraparound the way a browser's find bar steps.
 *
 * The runtime hands over the text it draws through `adapter`, gets the matches
 * back in its own nodes to highlight, and calls `refresh` whenever what it
 * draws changes under an open bar.
 */
export function useFind<N>(adapter: FindAdapter<N>, options?: FindOptions) {
	const [isOpen, setOpen] = useState(false);
	const [query, setQueryState] = useState("");
	const [matches, setMatches] = useState<FindMatch<N>[]>([]);
	const [index, setIndex] = useState(0);

	// Read by `refresh`, which content changing calls from outside any render.
	const queryRef = useRef("");
	const matchesRef = useRef<FindMatch<N>[]>([]);
	const indexRef = useRef(0);

	const commit = (found: FindMatch<N>[], current: number) => {
		matchesRef.current = found;
		indexRef.current = current;
		setMatches(found);
		setIndex(current);
	};

	const find = (query: string) =>
		FindUtils.search(adapter.blocks(), query, options);

	const select = (found: FindMatch<N>[], current: number) => {
		commit(found, current);
		const match = found[current];
		if (match) adapter.reveal?.(match);
	};

	const setQuery = (value: string) => {
		queryRef.current = value;
		setQueryState(value);
		select(find(value), 0);
	};

	/** Steps to the next match, or the previous with -1, wrapping at either end. */
	const step = (direction: 1 | -1) => {
		const found = matchesRef.current;
		if (!found.length) return;
		select(found, (indexRef.current + direction + found.length) % found.length);
	};

	/**
	 * Searches again for the same query, after what is drawn changed. The
	 * current match keeps its place without being scrolled back to, so content
	 * arriving does not pull the view along with it; and nothing re-renders
	 * when the same matches are found again.
	 */
	const refresh = () => {
		if (!queryRef.current) return;
		const found = find(queryRef.current);
		const previous = matchesRef.current;
		if (
			found.length === previous.length &&
			found.every((match, i) => FindUtils.isEqual(match, previous[i]))
		)
			return;
		commit(found, clamp(indexRef.current, found));
	};

	/** Opens the bar, finding the query it was closed with again. */
	const open = () => {
		setOpen(true);
		if (!queryRef.current) return;
		const found = find(queryRef.current);
		select(found, clamp(indexRef.current, found));
	};

	/** Closes the bar and clears its matches, keeping the query for next time. */
	const close = () => {
		setOpen(false);
		commit([], 0);
	};

	return {
		isOpen,
		open,
		close,
		query,
		setQuery,
		matches,
		/** The current match's place in `matches`. */
		index,
		current: matches[index] as FindMatch<N> | undefined,
		next: () => step(1),
		previous: () => step(-1),
		refresh,
		/** `3/12` while there are matches, `0/0` for a query without any. */
		label: query
			? `${matches.length ? index + 1 : 0}/${matches.length}`
			: undefined,
	};
}
