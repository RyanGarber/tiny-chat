import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

const SCROLL_BOTTOM_THRESHOLD = 80;

/**
 * Manages autoscroll behavior for a vertically-scrolling container.
 *
 * Features:
 * - Tracks whether the container is at the bottom (via native scroll listener)
 * - Scrolls to the bottom on new content (if already at bottom)
 * - Disengages autoscroll on intentional upward scroll (wheel/touch)
 * - Compensates for visual viewport resizes (mobile keyboard)
 * - Responds to an external "scroll requested" signal
 */
export function useAutoScroll({
  scrollRequested,
  isInitializing,
}: {
  /** Incrementing counter that triggers a smooth scroll-to-bottom */
  scrollRequested: number;
  /** While true, skip scroll-requested handling */
  isInitializing: boolean;
}): {
  viewportRef: RefObject<HTMLDivElement | null>;
  isAtBottom: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
} {
  const viewportRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const scrollRafIdRef = useRef<number | null>(null);

  const [isAtBottom, setIsAtBottom] = useState(true);

  const checkIsAtBottom = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return true;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD;
  }, []);

  const disengage = useCallback(() => {
    if (scrollRafIdRef.current !== null) {
      cancelAnimationFrame(scrollRafIdRef.current);
      scrollRafIdRef.current = null;
    }
    const el = viewportRef.current;
    if (isAtBottomRef.current && el && el.scrollHeight > el.clientHeight + 1) {
      isAtBottomRef.current = false;
      setIsAtBottom(false);
    }
  }, []);

  const animateScrollToBottom = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;

    // Cancel any existing loop so we always have the freshest state
    if (scrollRafIdRef.current !== null) {
      cancelAnimationFrame(scrollRafIdRef.current);
      scrollRafIdRef.current = null;
    }

    const step = () => {
      if (!isAtBottomRef.current) {
        scrollRafIdRef.current = null;
        return;
      }

      const targetTop = el.scrollHeight - el.clientHeight;
      const currentTop = el.scrollTop;
      const diff = targetTop - currentTop;

      if (diff > 1) {
        // Smooth approach: move 30% of remaining distance, at least 2px
        const move = Math.max(Math.ceil(diff * 0.3), 2);
        el.scrollTop = Math.min(currentTop + move, targetTop);
      }
      // No else: don't write scrollTop when already at bottom — avoids
      // spurious scroll events that could interfere with isScrollingUp detection.

      // Keep the loop alive every frame as long as we're stickied.
      // This ensures we never miss content growth while the loop was in flight.
      scrollRafIdRef.current = requestAnimationFrame(step);
    };

    scrollRafIdRef.current = requestAnimationFrame(step);
  }, []);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = 'instant') => {
      const el = viewportRef.current;
      if (!el) return;

      isAtBottomRef.current = true;
      setIsAtBottom(true);

      if (behavior === 'smooth') {
        animateScrollToBottom();
      } else {
        // Cancel any running animation, then jump instantly
        if (scrollRafIdRef.current !== null) {
          cancelAnimationFrame(scrollRafIdRef.current);
          scrollRafIdRef.current = null;
        }
        el.scrollTop = el.scrollHeight;
        // Restart the loop so we stay locked if content keeps growing
        animateScrollToBottom();
      }
    },
    [animateScrollToBottom],
  );

  // Native scroll listener tracking manual upward scrolls
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    let prevScrollTop = el.scrollTop;

    const onScroll = () => {
      const currentScrollTop = el.scrollTop;
      const isScrollingUp = currentScrollTop < prevScrollTop;
      prevScrollTop = currentScrollTop;

      const atBottom = checkIsAtBottom();

      if (atBottom) {
        if (!isAtBottomRef.current) {
          isAtBottomRef.current = true;
          setIsAtBottom(true);
        }
      } else if (isScrollingUp) {
        disengage();
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [checkIsAtBottom, disengage]);

  // Compensate for visual viewport resizing
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let prevHeight = vv.height;

    const onResize = () => {
      const el = viewportRef.current;
      if (!el) return;

      const newHeight = vv.height;
      const delta = prevHeight - newHeight;
      prevHeight = newHeight;

      if (Math.abs(delta) < 1) return;

      if (isAtBottomRef.current) el.scrollTop = el.scrollHeight;
      else if (delta > 0) el.scrollTop += delta;
    };

    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  // Gesture listeners to immediately engage manual scroll handling
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) disengage();
    };

    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      const deltaY = touchStartY - e.touches[0].clientY;
      if (deltaY < 0) disengage();
    };

    el.addEventListener('wheel', onWheel, { passive: true });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, [disengage]);

  // Auto-scroll natively when content height changes
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const contentEl = el.firstElementChild;
    if (!contentEl) return;

    let prevHeight = contentEl.scrollHeight;

    const observer = new ResizeObserver(() => {
      const newHeight = contentEl.scrollHeight;
      const delta = newHeight - prevHeight;
      prevHeight = newHeight;

      if (delta > 0 && isAtBottomRef.current) {
        isAtBottomRef.current = true;
        setIsAtBottom(true);
        animateScrollToBottom();
      }
    });

    observer.observe(contentEl);
    return () => observer.disconnect();
  }, [animateScrollToBottom]);

  // Respond to explicit scroll-to-bottom (e.g. after sending a message)
  useEffect(() => {
    if (scrollRequested > 0 && !isInitializing) {
      queueMicrotask(() => scrollToBottom('smooth'));
    }
  }, [scrollRequested, scrollToBottom, isInitializing]);

  return {
    viewportRef,
    isAtBottom,
    scrollToBottom,
  };
}
