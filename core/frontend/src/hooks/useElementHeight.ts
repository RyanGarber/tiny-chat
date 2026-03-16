import { RefObject, useLayoutEffect, useRef, useState } from 'react';

/**
 * Tracks the height of an element via ResizeObserver.
 * Returns a ref to attach to the element and the current height.
 */
export function useElementHeight(
  initialHeight = 0,
): { ref: RefObject<HTMLDivElement | null>; height: number } {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(initialHeight);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      setHeight(el.clientHeight);
    });

    observer.observe(el);
    setHeight(el.clientHeight);
    return () => observer.disconnect();
  }, []);

  return { ref, height };
}
