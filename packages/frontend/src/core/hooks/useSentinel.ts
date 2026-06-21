import { useIntersection } from '@mantine/hooks';
import { useIsFetching, type QueryKey, type UseInfiniteQueryResult } from '@tanstack/react-query';
import type { RefCallback} from 'react';
import { useCallback, useEffect, useState } from 'react';

export function useSentinel({
  query: { data, hasNextPage, isFetching, fetchNextPage },
  queryKey,
  onFetchNextPage,
}: {
  query: UseInfiniteQueryResult<unknown, unknown>;
  queryKey?: QueryKey;
  onFetchNextPage?: () => void;
}) {
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);

  const viewportRef = useCallback<RefCallback<HTMLDivElement>>((node) => {
    setViewport(node);
  }, []);

  const { ref, entry } = useIntersection({
    root: viewport,
    threshold: 0.5,
  });

  const isAnyFetching = useIsFetching({ queryKey });

  useEffect(() => {
    if (entry?.isIntersecting && hasNextPage && !isFetching && !isAnyFetching) {
      onFetchNextPage?.();
      void fetchNextPage();
    }
  }, [
    entry?.isIntersecting,
    hasNextPage,
    isFetching,
    isAnyFetching,
    fetchNextPage,
    data,
    onFetchNextPage,
  ]);

  return {
    viewportRef,
    sentinelRef: ref,
    isIntersecting: entry?.isIntersecting,
  };
}
