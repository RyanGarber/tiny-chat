import { useIntersection } from "@mantine/hooks";
import {
	type QueryKey,
	type UseInfiniteQueryResult,
	useIsFetching,
} from "@tanstack/react-query";
import type { RefCallback } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

/** Fraction of the sentinel that must be on screen to pull the next page */
const VISIBLE_RATIO = 0.5;

export function useSentinel({
	query: { hasNextPage, isFetching, fetchNextPage },
	queryKey,
	onFetchNextPage,
}: {
	query: UseInfiniteQueryResult<unknown, unknown>;
	queryKey?: QueryKey;
	onFetchNextPage?: () => void;
}) {
	const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
	const viewportNodeRef = useRef<HTMLDivElement | null>(null);

	const viewportRef = useCallback<RefCallback<HTMLDivElement>>((node) => {
		viewportNodeRef.current = node;
		setViewport(node);
	}, []);

	const { ref: intersectionRef, entry } = useIntersection({
		root: viewport,
		threshold: VISIBLE_RATIO,
	});

	const sentinelNodeRef = useRef<Element | null>(null);
	const sentinelRef = useCallback<RefCallback<HTMLDivElement>>(
		(node) => {
			sentinelNodeRef.current = node;
			intersectionRef(node);
		},
		[intersectionRef],
	);

	const isAnyFetching = useIsFetching({ queryKey }) > 0;

	/**
	 * `entry` is a snapshot from the last time the observer fired, and the
	 * observer only fires once the browser gets around to it. Measuring instead
	 * of trusting that snapshot is what keeps a completed fetch from immediately
	 * triggering another one for a sentinel that has already scrolled away.
	 */
	const isSentinelVisible = useCallback(() => {
		const root = viewportNodeRef.current;
		const node = sentinelNodeRef.current;
		if (!root || !node) return false;

		const rootRect = root.getBoundingClientRect();
		const nodeRect = node.getBoundingClientRect();
		const visible =
			Math.min(nodeRect.bottom, rootRect.bottom) -
			Math.max(nodeRect.top, rootRect.top);

		if (visible <= 0) return false;
		return nodeRect.height === 0 || visible / nodeRect.height >= VISIBLE_RATIO;
	}, []);

	// Held from the moment a page is requested until the DOM has settled again,
	// so only one page is ever in flight.
	const isPagingRef = useRef(false);
	// The paging loop outlives the render that started it, so it continues
	// through the newest callback rather than its own stale closure.
	const fetchNextRef = useRef<() => void>(() => {});

	const fetchNext = useCallback(() => {
		if (isPagingRef.current) return;
		if (!hasNextPage || isFetching || isAnyFetching) return;
		if (!isSentinelVisible()) return;

		isPagingRef.current = true;
		onFetchNextPage?.();
		void fetchNextPage().finally(() => {
			// Release a frame after the new page has been laid out and the viewport
			// repositioned, otherwise the visibility check would still see the
			// sentinel where it sat before the page was added.
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					isPagingRef.current = false;
					// A single page may not be enough to push the sentinel off screen.
					fetchNextRef.current();
				});
			});
		});
	}, [
		hasNextPage,
		isFetching,
		isAnyFetching,
		fetchNextPage,
		onFetchNextPage,
		isSentinelVisible,
	]);

	fetchNextRef.current = fetchNext;

	useEffect(() => {
		if (entry?.isIntersecting) fetchNext();
	}, [entry?.isIntersecting, fetchNext]);

	return {
		viewportRef,
		sentinelRef,
		isIntersecting: entry?.isIntersecting,
	};
}
