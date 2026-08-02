import type { UseInfiniteQueryResult } from "@tanstack/react-query";
import type { ScrollViewRef } from "ink-scroll-view";
import { type RefObject, useCallback } from "react";

/**
 * Terminal counterpart of the web sentinel: instead of observing an element,
 * it watches the scroll offset and fetches the next page once the viewport
 * reaches the edge the older content lives on — the top for messages, the
 * bottom for chats.
 */
export function useSentinel({
	scrollRef,
	query: { hasNextPage, isFetching, fetchNextPage },
	edge,
	threshold = 0,
	onFetchNextPage,
}: {
	scrollRef: RefObject<ScrollViewRef | null>;
	query: UseInfiniteQueryResult<unknown, unknown>;
	/** Which end of the list the next page is appended to */
	edge: "top" | "bottom";
	/** Rows away from the edge at which fetching starts */
	threshold?: number;
	onFetchNextPage?: () => void;
}) {
	const check = useCallback(
		(offset?: number) => {
			const view = scrollRef.current;
			if (!view || !hasNextPage || isFetching) return;

			// Nothing measured yet, so any offset we read would be meaningless.
			if (view.getViewportHeight() === 0 || view.getContentHeight() === 0)
				return;

			const current = offset ?? view.getScrollOffset();
			const distance =
				edge === "top" ? current : view.getBottomOffset() - current;
			if (distance > threshold) return;

			onFetchNextPage?.();
			void fetchNextPage();
		},
		[
			scrollRef,
			hasNextPage,
			isFetching,
			fetchNextPage,
			edge,
			threshold,
			onFetchNextPage,
		],
	);

	const onContentHeightChange = useCallback(() => check(), [check]);
	const onViewportSizeChange = useCallback(() => check(), [check]);

	return { onScroll: check, onContentHeightChange, onViewportSizeChange };
}
