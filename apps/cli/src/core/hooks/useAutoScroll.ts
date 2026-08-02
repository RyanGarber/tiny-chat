import type { ScrollViewRef } from "ink-scroll-view";
import { type RefObject, useCallback, useEffect, useRef } from "react";

/** Rows of slack still counted as being at the bottom. */
const SCROLL_BOTTOM_THRESHOLD = 1;

/**
 * Keeps a ScrollView pinned to the newest content.
 *
 * Features:
 * - Sticks to the bottom while content grows (new/streaming messages)
 * - Disengages as soon as the user scrolls up
 * - Re-engages once the user scrolls back down to the bottom
 * - Re-engages and jumps to the bottom whenever `resetKey` changes (e.g. opening a chat)
 */
export function useAutoScroll({
	scrollRef,
	resetKey,
}: {
	scrollRef: RefObject<ScrollViewRef | null>;
	/** Changing this re-engages autoscroll and jumps back to the bottom */
	resetKey?: string | null;
}) {
	const isAtBottomRef = useRef(true);
	const isScrollingRef = useRef(false);
	const previousOffsetRef = useRef(0);

	const scrollToBottom = useCallback(() => {
		const view = scrollRef.current;
		if (!view) return;
		isScrollingRef.current = true;
		view.scrollToBottom();
		isScrollingRef.current = false;
		isAtBottomRef.current = true;
		previousOffsetRef.current = view.getScrollOffset();
	}, [scrollRef]);

	const onScroll = useCallback(
		(offset: number) => {
			const previousOffset = previousOffsetRef.current;
			previousOffsetRef.current = offset;

			const view = scrollRef.current;
			if (!view || isScrollingRef.current) return;

			// Scrolling up always disengages, so we never fight the user.
			if (offset < previousOffset) isAtBottomRef.current = false;
			else if (view.getBottomOffset() - offset <= SCROLL_BOTTOM_THRESHOLD)
				isAtBottomRef.current = true;
		},
		[scrollRef],
	);

	/**
	 * Follows newly measured content. Only safe to call once measurements have
	 * settled: ScrollView reports the *filled* viewport height, so asking for the
	 * bottom mid-measurement can land the view past the last row.
	 */
	const pinToBottom = useCallback(() => {
		if (isAtBottomRef.current) scrollToBottom();
	}, [scrollToBottom]);

	const previousResetKeyRef = useRef(resetKey);
	useEffect(() => {
		if (previousResetKeyRef.current === resetKey) return;
		previousResetKeyRef.current = resetKey;
		scrollToBottom();
	}, [resetKey, scrollToBottom]);

	return { isAtBottomRef, pinToBottom, onScroll };
}
