import type { UseInfiniteQueryResult } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

/**
 * Terminal counterpart of the web sentinel: instead of observing an element,
 * it hands back the callback a {@link ScrollView} edge fires, so reaching the
 * end the older content lives on pulls in the next page.
 */
export function useSentinel({
	hasNextPage,
	isFetchingNextPage,
	fetchNextPage,
}: UseInfiniteQueryResult<unknown, unknown>) {
	// An edge is only reported as it is crossed, so one turned down while a page
	// is already on its way is not one the view will offer again: a list resting
	// against its end has nowhere left to scroll, and so nothing left to cross.
	const pending = useRef(false);

	useEffect(() => {
		if (isFetchingNextPage || !pending.current) return;
		pending.current = false;
		if (hasNextPage) void fetchNextPage();
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	return useCallback(() => {
		if (!hasNextPage) return;
		if (isFetchingNextPage) {
			pending.current = true;
			return;
		}
		void fetchNextPage();
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);
}
