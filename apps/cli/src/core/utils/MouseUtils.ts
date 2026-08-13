import { type DOMElement, measureElement } from "ink";

/** A position in terminal cells, measured from the top left of the screen. */
export type MousePoint = {
	x: number;
	y: number;
};

/** A rectangle in terminal cells, measured from the top left of the screen. */
export type MouseBounds = MousePoint & {
	width: number;
	height: number;
};

export type MouseButton = "left" | "middle" | "right" | "none";

export type MouseEvent = MousePoint & {
	type: "down" | "up" | "move" | "wheel";
	button: MouseButton;
	/** Wheel steps, negative up and positive down. Zero for every other event. */
	deltaY: number;
	/** Wheel steps, negative left and positive right. Zero for every other event. */
	deltaX: number;
	ctrl: boolean;
	alt: boolean;
	shift: boolean;
};

/**
 * SGR mouse report: `ESC [ < button ; column ; row M` for a press (`m` for a
 * release), with coordinates counted from 1.
 */
const SGR_REGEX =
	// biome-ignore lint/suspicious/noControlCharactersInRegex: terminal hell
	/\x1b\[<(\d+);(\d+);(\d+)([Mm])/g;

/** Low two bits of the button code, once the modifier and mode bits are masked off. */
const BUTTONS: MouseButton[] = ["left", "middle", "right", "none"];

const SHIFT = 4;
const ALT = 8;
const CTRL = 16;
/** The pointer moved rather than a button changing state. */
const MOTION = 32;
/** The wheel turned, with the button bits carrying the direction. */
const WHEEL = 64;

export const MouseUtils = {
	/**
	 * Pulls every mouse report out of a chunk of terminal input, ignoring
	 * anything else it is bundled with.
	 */
	parse: (data: string): MouseEvent[] => {
		const events: MouseEvent[] = [];

		for (const match of data.matchAll(SGR_REGEX)) {
			const code = Number.parseInt(match[1], 10);
			const direction = code & 3;
			const isWheel = (code & WHEEL) !== 0;

			events.push({
				type: isWheel
					? "wheel"
					: (code & MOTION) !== 0
						? "move"
						: match[4] === "m"
							? "up"
							: "down",
				button: isWheel ? "none" : BUTTONS[direction],
				deltaY: isWheel && direction < 2 ? (direction === 0 ? -1 : 1) : 0,
				deltaX: isWheel && direction >= 2 ? (direction === 2 ? -1 : 1) : 0,
				x: Number.parseInt(match[2], 10) - 1,
				y: Number.parseInt(match[3], 10) - 1,
				shift: (code & SHIFT) !== 0,
				alt: (code & ALT) !== 0,
				ctrl: (code & CTRL) !== 0,
			});
		}

		return events;
	},

	/**
	 * Removes every mouse report from a chunk of terminal input, leaving the
	 * keystrokes it was bundled with behind.
	 */
	strip: (data: string): string => data.replace(SGR_REGEX, ""),

	/**
	 * Where an element sits on screen, in the same coordinates mouse reports use.
	 *
	 * {@link measureElement} positions a node inside Ink's live region, which is
	 * anchored to the bottom of the terminal, so the region's own top row is
	 * however far it falls short of filling the screen.
	 */
	bounds: (node: DOMElement, rows: number): MouseBounds => {
		const { x, y, width, height } = measureElement(node);

		let root = node;
		while (root.parentNode) root = root.parentNode;

		const top = rows - (root.yogaNode?.getComputedHeight() ?? rows);

		return { x, y: y + top, width, height };
	},

	contains: (bounds: MouseBounds, point: MousePoint) =>
		point.x >= bounds.x &&
		point.x < bounds.x + bounds.width &&
		point.y >= bounds.y &&
		point.y < bounds.y + bounds.height,
} as const;
