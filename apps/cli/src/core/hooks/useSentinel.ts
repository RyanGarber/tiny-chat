import type { UseInfiniteQueryResult } from "@tanstack/react-query";
import { useCallback } from "react";

/**
 * Terminal counterpart of the web sentinel: instead of observing an element,
 * it hands back the callback a {@link ScrollView} edge fires, so reaching the
 * end the older content lives on pulls in the next page.
 */
export function useSentinel({
	hasNextPage,
	isFetching,
	fetchNextPage,
}: UseInfiniteQueryResult<unknown, unknown>) {
	return useCallback(() => {
		if (!hasNextPage || isFetching) return;
		void fetchNextPage();
	}, [hasNextPage, isFetching, fetchNextPage]);
}
