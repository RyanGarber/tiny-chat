import type { DOMElement } from "ink";
import { useWindowSize } from "ink";
import { useCallback, useRef } from "react";
import {
	type MouseBounds,
	type MouseEvent,
	MouseUtils,
} from "../utils/MouseUtils.ts";
import { useMouse } from "./useMouse.ts";

/** Keeps a point the pointer left the element with inside of it. */
const clamp = (event: MouseEvent, bounds: MouseBounds): MouseEvent => ({
	...event,
	x: Math.min(Math.max(event.x - bounds.x, 0), Math.max(0, bounds.width - 1)),
	y: Math.min(Math.max(event.y - bounds.y, 0), Math.max(0, bounds.height - 1)),
});

/**
 * Subscribes to high-level mouse events for one or more elements.
 */
export const useMouseInput = ({
	onClick,
	onDrag,
	onDragEnd,
	onHoverStart,
	onHoverEnd,
	isActive = true,
}: {
	onClick?: (_: { index: number; event: MouseEvent }) => void;
	/** Called when the mouse pointer drags on the element. */
	onDrag?: (_: { index: number; event: MouseEvent }) => void;
	/** Called when the mouse pointer lets go of the element. */
	onDragEnd?: (_: { index: number; event: MouseEvent }) => void;
	/** Called when the mouse pointer enters the element. */
	onHoverStart?: (_: { index: number; event: MouseEvent }) => void;
	/** Called when the mouse pointer leaves the element. */
	onHoverEnd?: (_: { index: number; event: MouseEvent }) => void;
	isActive?: boolean;
} = {}) => {
	const { rows } = useWindowSize();

	const refs = useRef<DOMElement[]>([]);
	const mouseRef = useCallback((element: DOMElement | null, index?: number) => {
		index ??= 0;
		if (element) {
			refs.current[index] = element;
		} else {
			delete refs.current[index];
		}
	}, []);

	const hovers = useRef<Set<number>>(new Set());
	const drags = useRef<Set<number>>(new Set());

	useMouse({
		handler: (event) => {
			if (event.type === "wheel") return;

			for (let i = 0; i < refs.current.length; i++) {
				// Registering by index leaves holes behind when a row unmounts.
				const element = refs.current[i];
				if (!element) continue;

				const bounds = MouseUtils.bounds(element, rows);

				if (MouseUtils.contains(bounds, event)) {
					if (!hovers.current.has(i)) {
						hovers.current.add(i);
						onHoverStart?.({
							index: i,
							event: { ...event, x: event.x - bounds.x, y: event.y - bounds.y },
						});
					}
				} else {
					if (hovers.current.has(i)) {
						hovers.current.delete(i);
						onHoverEnd?.({
							index: i,
							event: { ...event, x: event.x - bounds.x, y: event.y - bounds.y },
						});
					}
					continue;
				}

				if (event.type === "down") {
					onClick?.({
						index: i,
						event: { ...event, x: event.x - bounds.x, y: event.y - bounds.y },
					});
					drags.current.add(i);
				}

				if (drags.current.has(i) && event.type === "move") {
					onDrag?.({ index: i, event: clamp(event, bounds) });
				}

				if (drags.current.has(i) && event.type === "up") {
					drags.current.delete(i);
					onDragEnd?.({ index: i, event: clamp(event, bounds) });
				}
			}
		},
		motion: !!onHoverStart || !!onHoverEnd,
		drag: !!onDrag,
		isActive,
	});

	return { mouseRef };
};
