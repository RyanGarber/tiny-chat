import { type DOMElement, useBoxMetrics, useWindowSize } from "ink";
import {
	Children,
	isValidElement,
	type ReactNode,
	type RefObject,
	useCallback,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useMouse } from "../hooks/useMouse.ts";
import { MouseUtils } from "../utils/MouseUtils.ts";
import Box, { type BoxProps } from "./Box.tsx";

/** Where a child comes to rest when the view scrolls to it. */
export type ScrollAlign =
	/** Moves by the least amount that brings the child fully into view. */
	"auto" | "top" | "bottom" | "center";

export interface ScrollViewRef {
	/** Rows between the top of the content and the top of the viewport. */
	getScrollOffset: () => number;
	getContentHeight: () => number;
	getViewportHeight: () => number;
	/** The offset at which the last row of content sits on the last row of the viewport. */
	getMaxOffset: () => number;
	/** Where a child sits within the content, or null if there is no such child. */
	getItemPosition: (index: number) => { top: number; height: number } | null;
	isAtTop: () => boolean;
	isAtBottom: () => boolean;
	scrollTo: (offset: number) => void;
	scrollBy: (delta: number) => void;
	scrollToTop: () => void;
	scrollToBottom: () => void;
	scrollToIndex: (index: number, align?: ScrollAlign) => void;
}

export interface ScrollViewProps extends Omit<BoxProps, "overflow"> {
	ref?: RefObject<ScrollViewRef | null>;
	children?: ReactNode;

	/**
	 * Child the view keeps visible. It scrolls only once the child would fall
	 * outside the viewport, and only by the rows that takes.
	 */
	selectedIndex?: number;
	/** @default "auto" */
	align?: ScrollAlign;

	/**
	 * Holds the view on the newest content while it is already resting there,
	 * and lets go the moment the reader scrolls away from it.
	 */
	stickToBottom?: boolean;
	/** Returns the view to its resting position whenever this changes. */
	resetKey?: string | null;

	/** @default true */
	wheel?: boolean;
	/** Rows a single turn of the wheel moves. @default 3 */
	wheelStep?: number;

	onScroll?: (offset: number) => void;
	/** Called while the viewport rests within {@link edgeThreshold} of the top. */
	onReachTop?: () => void;
	/** Called while the viewport rests within {@link edgeThreshold} of the bottom. */
	onReachBottom?: () => void;
	/** Rows from an edge that still count as having reached it. @default 0 */
	edgeThreshold?: number;
}

const height = (node: DOMElement | null) =>
	node?.yogaNode?.getComputedHeight() ?? 0;

const clamp = (value: number, min: number, max: number) =>
	Math.min(Math.max(value, min), Math.max(min, max));

/**
 * A viewport onto content taller than itself.
 *
 * Scrolling is a single number — the rows of content hidden above the viewport —
 * and every position it is set to is one the reader asked for: a wheel turn
 * moves by its own rows, a selection moves by the rows it takes to come back
 * into view, and nothing else moves the view on its own.
 *
 * Heights are read from the layout Ink has just computed rather than cached, so
 * a child that grows on its own — a streaming message, a tool call being
 * expanded — is accounted for without having to announce itself.
 */
export default function ScrollView({
	ref,
	children,
	selectedIndex,
	align = "auto",
	stickToBottom = false,
	resetKey,
	wheel = true,
	wheelStep = 3,
	onScroll,
	onReachTop,
	onReachBottom,
	edgeThreshold = 0,
	...props
}: ScrollViewProps) {
	const { rows } = useWindowSize();

	const viewportRef = useRef<DOMElement | null>(null);
	const contentRef = useRef<DOMElement | null>(null);
	const itemsRef = useRef<(DOMElement | null)[]>([]);

	// Rendered through state, tracked through a ref: a wheel turn has to read the
	// offset it is moving from before React has committed the last one.
	const [offset, setOffsetState] = useState(0);
	const offsetRef = useRef(0);

	// While pinned the content is laid out against the bottom of the viewport
	// instead of an offset, so content that grows stays in view for free — no
	// measurement, and no frame spent catching up to it.
	const [pinned, setPinnedState] = useState(stickToBottom);
	const pinnedRef = useRef(stickToBottom);

	// Measured from the children rather than the box holding them: that box is
	// floored at the height of the viewport so short content still starts at the
	// top, which would otherwise report every list shorter than the viewport as
	// the same height and hide the fact that one of them had grown.
	const getContentHeight = useCallback(() => {
		for (let index = itemsRef.current.length - 1; index >= 0; index--) {
			const node = itemsRef.current[index];
			if (node?.yogaNode) return node.yogaNode.getComputedTop() + height(node);
		}
		return 0;
	}, []);
	const getViewportHeight = useCallback(() => height(viewportRef.current), []);
	const getMaxOffset = useCallback(
		() => Math.max(0, getContentHeight() - getViewportHeight()),
		[getContentHeight, getViewportHeight],
	);

	const getScrollOffset = useCallback(
		() =>
			pinnedRef.current
				? getMaxOffset()
				: Math.min(offsetRef.current, getMaxOffset()),
		[getMaxOffset],
	);

	const getItemPosition = useCallback((index: number) => {
		const node = itemsRef.current[index];
		if (!node?.yogaNode) return null;
		return { top: node.yogaNode.getComputedTop(), height: height(node) };
	}, []);

	const scrollTo = useCallback(
		(next: number) => {
			const max = getMaxOffset();
			const target = clamp(next, 0, max);
			// Reaching the bottom is what re-engages sticking to it, so following
			// the newest content is never something the reader has to ask for twice.
			const isPinned = stickToBottom && target >= max;

			if (target === offsetRef.current && isPinned === pinnedRef.current)
				return;

			offsetRef.current = target;
			pinnedRef.current = isPinned;
			setOffsetState(target);
			setPinnedState(isPinned);
			onScroll?.(target);
		},
		[getMaxOffset, stickToBottom, onScroll],
	);

	const scrollBy = useCallback(
		(delta: number) => scrollTo(getScrollOffset() + delta),
		[scrollTo, getScrollOffset],
	);

	const scrollToIndex = useCallback(
		(index: number, mode: ScrollAlign = align) => {
			const position = getItemPosition(index);
			if (!position) return;

			const viewport = getViewportHeight();
			const current = getScrollOffset();
			const bottom = position.top + position.height - viewport;

			if (mode === "top") return scrollTo(position.top);
			if (mode === "bottom") return scrollTo(bottom);
			if (mode === "center")
				return scrollTo(position.top + (position.height - viewport) / 2);

			// Anything already in view stays exactly where it is. A child taller than
			// the viewport is met at its top rather than scrolled through.
			if (position.top < current) return scrollTo(position.top);
			if (position.top + position.height > current + viewport)
				return scrollTo(Math.min(position.top, bottom));
		},
		[align, getItemPosition, getViewportHeight, getScrollOffset, scrollTo],
	);

	useImperativeHandle(
		ref,
		() => ({
			getScrollOffset,
			getContentHeight,
			getViewportHeight,
			getMaxOffset,
			getItemPosition,
			isAtTop: () => getScrollOffset() <= 0,
			isAtBottom: () => getScrollOffset() >= getMaxOffset(),
			scrollTo,
			scrollBy,
			scrollToTop: () => scrollTo(0),
			scrollToBottom: () => scrollTo(getMaxOffset()),
			scrollToIndex,
		}),
		[
			getScrollOffset,
			getContentHeight,
			getViewportHeight,
			getMaxOffset,
			getItemPosition,
			scrollTo,
			scrollBy,
			scrollToIndex,
		],
	);

	// The wheel turns over whatever the pointer is resting on, so views sitting
	// side by side — a transcript under a list of completions — each answer for
	// themselves without either having to be focused first.
	useMouse({
		handler: (event) => {
			if (event.type !== "wheel" || event.deltaY === 0) return;

			const node = viewportRef.current;
			if (!node) return;
			if (!MouseUtils.contains(MouseUtils.bounds(node, rows), event)) return;

			scrollBy(event.deltaY * wheelStep);
		},
		isActive: wheel,
	});

	const items = useMemo(() => {
		const list = Children.toArray(children);
		itemsRef.current.length = list.length;
		return list;
	}, [children]);

	// Identity of the children as they were last laid out, so a page of older
	// content arriving above the viewport can be told apart from one appended
	// below it.
	const keys = useMemo(
		() =>
			items.map((child, index) =>
				isValidElement(child) ? String(child.key ?? index) : String(index),
			),
		[items],
	);
	const previousKeysRef = useRef<string[] | null>(null);

	const previousResetKeyRef = useRef(resetKey);
	const previousSelectedRef = useRef<number | undefined>(undefined);
	const previousSelectedKeyRef = useRef<string | undefined>(undefined);
	const lastEdgeRef = useRef({ top: false, bottom: false, content: -1 });

	// Ink recomputes the whole layout before this runs, so every height read here
	// is the one about to be drawn.
	useLayoutEffect(() => {
		const previousKeys = previousKeysRef.current;
		previousKeysRef.current = keys;

		if (previousResetKeyRef.current !== resetKey) {
			previousResetKeyRef.current = resetKey;
			lastEdgeRef.current = { top: false, bottom: false, content: -1 };
			scrollTo(stickToBottom ? getMaxOffset() : 0);
		} else if (previousKeys?.length && !pinnedRef.current) {
			// Content added above the viewport would otherwise carry it down by the
			// height of the new content, so the row being read is held in place.
			const shift = keys.indexOf(previousKeys[0]);
			const position = shift > 0 ? getItemPosition(shift) : null;
			if (position) scrollTo(offsetRef.current + position.top);
		}

		// Content that shrank out from under the view — a tool call collapsing, a
		// page dropping out of the cache — would otherwise leave it resting on rows
		// that are no longer there.
		if (!pinnedRef.current && offsetRef.current > getMaxOffset())
			scrollTo(offsetRef.current);

		// Only a selection that actually moved reaches for the view. Re-asserting
		// it on every pass would take the view back off the reader the moment they
		// turned the wheel away from it, and again every time a page landed.
		const selectedKey =
			selectedIndex === undefined ? undefined : keys[selectedIndex];
		const moved =
			selectedIndex !== previousSelectedRef.current ||
			selectedKey !== previousSelectedKeyRef.current;
		previousSelectedRef.current = selectedIndex;
		previousSelectedKeyRef.current = selectedKey;

		if (moved && selectedIndex !== undefined && selectedIndex >= 0)
			scrollToIndex(selectedIndex);

		// Nothing has been laid out yet, so any edge would be one every view is at.
		const content = getContentHeight();
		if (getViewportHeight() === 0 || content === 0) return;

		const current = getScrollOffset();
		const edge = {
			top: current <= edgeThreshold,
			bottom: getMaxOffset() - current <= edgeThreshold,
			content,
		};
		const last = lastEdgeRef.current;
		lastEdgeRef.current = edge;

		// Resting against an edge only counts once, until either the reader leaves
		// it or the content that arrived leaves the view still resting there.
		if (edge.top && (!last.top || last.content !== content)) onReachTop?.();
		if (edge.bottom && (!last.bottom || last.content !== content))
			onReachBottom?.();
	});

	// Re-runs the effect above whenever anything under the view changes shape,
	// including a child that re-rendered without the view itself re-rendering.
	useBoxMetrics(contentRef);

	return (
		// Sizing and spacing are the caller's, and are kept off the viewport so the
		// height measured for it is the height content is actually shown through.
		<Box flexDirection="column" {...props}>
			<Box
				ref={viewportRef}
				// Overflowing content is laid out past the edges of this box and
				// clipped to it, which is what makes it a viewport rather than a list.
				overflow="hidden"
				flexDirection="column"
				flexGrow={1}
				flexShrink={1}
				minHeight={0}
				justifyContent={pinned ? "flex-end" : "flex-start"}
			>
				<Box
					ref={contentRef}
					flexDirection="column"
					// Never shrinks, so it keeps the full height of its children and
					// overflows the viewport rather than being squeezed into it.
					flexShrink={0}
					// While pinned, content shorter than the viewport would hang off the
					// bottom it is laid out against, so it is floored at the height of the
					// viewport to bring it back to the top. Only while pinned: the floor
					// is a percentage, and a percentage resolves against the height a view
					// has been offered rather than the one it settles at, so a view free
					// to size itself to its content — one bounded only by a maxHeight —
					// would be held open at that bound by content that never filled it.
					minHeight={pinned ? "100%" : undefined}
					marginTop={pinned ? 0 : -offset}
				>
					{items.map((child, index) => (
						<Box
							// Keyed by the child so a page arriving above the viewport moves
							// the wrappers along with it instead of remounting every child
							// into a new position.
							key={keys[index]}
							ref={(node) => {
								itemsRef.current[index] = node;
							}}
							flexShrink={0}
							flexDirection="column"
						>
							{child}
						</Box>
					))}
				</Box>
			</Box>
		</Box>
	);
}
