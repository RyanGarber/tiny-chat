import type { RefCallback } from "react";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

/** Height given to an item before any has been measured, in pixels. */
const DEFAULT_ESTIMATE = 160;

interface Placement {
	first: string;
	last: string;
	/** Heights of the items held in slots, as of when the window was placed. */
	heights: ReadonlyMap<string, number>;
	estimate: number;
}

/**
 * Windows a long list in a scrolling viewport: only the items within `overscan`
 * pixels of what is on screen are mounted.
 *
 * Every item keeps a slot in the list. A slot whose item is not mounted is held
 * at the height that item was last measured at, or at the average of those that
 * have been, so the list is always laid out at full height: the scrollbar, the
 * offsets of everything below and the anchors {@link useAutoScroll} holds the
 * view to all stay what they would be with the whole list drawn. The slots are
 * also how the window is found — they are where the items actually are, gaps
 * and all — so nothing has to be added up.
 */
export function useVirtualList({
	viewport,
	keys,
	overscan = 1200,
	atBottom,
}: {
	viewport: HTMLElement | null;
	/** Identity of each item, in order. */
	keys: string[];
	/** Pixels beyond each edge of the viewport whose items stay mounted. */
	overscan?: number;
	/**
	 * Whether the view is resting on the newest item, where the window is placed
	 * while it scrolls there.
	 */
	atBottom?: () => boolean;
}) {
	const heightsRef = useRef(new Map<string, number>());
	const slotsRef = useRef(new Map<string, HTMLElement>());
	const keysRef = useRef(keys);
	const atBottomRef = useRef(atBottom);
	useLayoutEffect(() => {
		keysRef.current = keys;
		atBottomRef.current = atBottom;
	});

	const [placement, setPlacement] = useState<Placement | null>(null);

	const update = useCallback(() => {
		const keys = keysRef.current;
		if (!viewport || !keys.length) return;
		const slot = (index: number) => slotsRef.current.get(keys[index]);

		const viewportTop = viewport.getBoundingClientRect().top;
		const scrollTop = atBottomRef.current?.()
			? Math.max(viewport.scrollHeight - viewport.clientHeight, 0)
			: viewport.scrollTop;
		// Slot positions within the scrolled content.
		const top = (index: number) =>
			(slot(index)?.getBoundingClientRect().top ?? 0) -
			viewportTop +
			viewport.scrollTop;
		const windowTop = scrollTop - overscan;
		const windowBottom = scrollTop + viewport.clientHeight + overscan;

		// First slot that reaches below the top of the window.
		let low = 0;
		let high = keys.length - 1;
		let first = keys.length - 1;
		while (low <= high) {
			const middle = (low + high) >> 1;
			if (top(middle) + (slot(middle)?.offsetHeight ?? 0) < windowTop)
				low = middle + 1;
			else {
				first = middle;
				high = middle - 1;
			}
		}
		// Last slot that starts above the bottom of the window.
		low = first;
		high = keys.length - 1;
		let last = first;
		while (low <= high) {
			const middle = (low + high) >> 1;
			if (top(middle) <= windowBottom) {
				last = middle;
				low = middle + 1;
			} else high = middle - 1;
		}

		const heights = heightsRef.current;
		let total = 0;
		for (const height of heights.values()) total += height;
		const estimate = heights.size ? total / heights.size : DEFAULT_ESTIMATE;

		setPlacement((current) =>
			current?.first === keys[first] &&
			current.last === keys[last] &&
			current.heights === heights
				? current
				: { first: keys[first], last: keys[last], heights, estimate },
		);
	}, [viewport, overscan]);

	// Coalesced to a frame: scrolling and a burst of resizes ask many times.
	const frameRef = useRef<number | null>(null);
	const schedule = useCallback(() => {
		if (frameRef.current !== null) return;
		frameRef.current = requestAnimationFrame(() => {
			frameRef.current = null;
			update();
		});
	}, [update]);
	const scheduleRef = useRef(schedule);
	useLayoutEffect(() => {
		scheduleRef.current = schedule;
	}, [schedule]);
	useEffect(
		() => () => {
			if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
		},
		[],
	);

	// Measures every item while it is in its slot. A new map on any change is
	// what tells the window its placeholders have new heights to take.
	const observerRef = useRef<ResizeObserver | null>(null);
	useLayoutEffect(() => {
		const observer = new ResizeObserver((entries) => {
			let heights: Map<string, number> | null = null;
			for (const entry of entries) {
				const node = entry.target as HTMLElement;
				const key = node.dataset.virtualKey;
				if (!key || node.dataset.virtualMounted !== "true") continue;
				const height = entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight;
				if (heightsRef.current.get(key) === height) continue;
				heights ??= new Map(heightsRef.current);
				heights.set(key, height);
			}
			if (heights) {
				heightsRef.current = heights;
				scheduleRef.current();
			}
		});
		observerRef.current = observer;
		// Slots attach before this runs on the first commit.
		for (const node of slotsRef.current.values()) observer.observe(node);
		return () => {
			observer.disconnect();
			observerRef.current = null;
		};
	}, []);

	// One callback per key, so a slot is not detached and re-attached on every
	// render.
	const refsRef = useRef(new Map<string, RefCallback<HTMLElement>>());
	const slotRef = useCallback((key: string) => {
		let ref = refsRef.current.get(key);
		if (!ref) {
			ref = (node) => {
				const previous = slotsRef.current.get(key);
				if (previous && previous !== node) {
					observerRef.current?.unobserve(previous);
					slotsRef.current.delete(key);
				}
				if (node) {
					slotsRef.current.set(key, node);
					observerRef.current?.observe(node);
				} else refsRef.current.delete(key);
			};
			refsRef.current.set(key, ref);
		}
		return ref;
	}, []);

	useEffect(() => {
		if (!viewport) return;
		viewport.addEventListener("scroll", schedule, { passive: true });
		const resize = new ResizeObserver(schedule);
		resize.observe(viewport);
		return () => {
			viewport.removeEventListener("scroll", schedule);
			resize.disconnect();
		};
	}, [viewport, schedule]);

	// Items that have gone keep no height, so the estimate follows the list.
	useLayoutEffect(() => {
		const present = new Set(keys);
		if ([...heightsRef.current.keys()].some((key) => !present.has(key)))
			heightsRef.current = new Map(
				[...heightsRef.current].filter(([key]) => present.has(key)),
			);
		update();
	}, [keys, update]);

	const first = placement ? keys.indexOf(placement.first) : -1;
	const last = placement ? keys.lastIndexOf(placement.last) : -1;
	const placed = first >= 0 && last >= first;

	/**
	 * Whether an item is mounted. Until the window has been placed, only the
	 * newest item is, so a long chat costs one item to open rather than all.
	 */
	const isMounted = (index: number) =>
		placed ? index >= first && index <= last : index === keys.length - 1;

	/** Props for an item's slot. */
	const slotProps = (index: number) => {
		const key = keys[index];
		const mounted = isMounted(index);
		return {
			ref: slotRef(key),
			"data-virtual-key": key,
			"data-virtual-mounted": String(mounted),
			style: mounted
				? undefined
				: {
						height:
							placement?.heights.get(key) ??
							placement?.estimate ??
							DEFAULT_ESTIMATE,
					},
		};
	};

	return { isMounted, slotProps };
}
