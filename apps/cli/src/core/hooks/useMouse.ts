import { useStdin } from "ink";
import { useEffect, useEffectEvent } from "react";
import { type MouseEvent, MouseUtils } from "../utils/MouseUtils.ts";
import { StdinUtils } from "../utils/StdinUtils.ts";

// 1000 reports button presses, 1006 reports the coordinates in SGR form, which
// lifts the 223 column ceiling of the original encoding. 1002 adds a report for
// every pointer move made with a button held, which is what a drag is, and 1003
// adds one for every move at all, which is only worth its noise when something
// is hovering.
const TRACKING = "\x1b[?1000h\x1b[?1006h";
const TRACKING_OFF = "\x1b[?1006l\x1b[?1000l";
const DRAG = "\x1b[?1002h";
const DRAG_OFF = "\x1b[?1002l";
const MOTION = "\x1b[?1003h";
const MOTION_OFF = "\x1b[?1003l";

type Listener = (event: MouseEvent) => void;

const listeners = new Set<Listener>();
const dragListeners = new Set<Listener>();
const motionListeners = new Set<Listener>();

let stream: NodeJS.ReadStream | null = null;

/**
 * Holds the terminal to the widest reporting anyone still asks for. The modes
 * overlap, so they are switched one at a time rather than counted apart.
 */
let reporting: "none" | "drag" | "motion" = "none";

const sync = () => {
	const next = motionListeners.size
		? "motion"
		: dragListeners.size
			? "drag"
			: "none";
	if (next === reporting) return;

	if (reporting === "motion") process.stdout.write(MOTION_OFF);
	else if (reporting === "drag") process.stdout.write(DRAG_OFF);

	if (next === "motion") process.stdout.write(MOTION);
	else if (next === "drag") process.stdout.write(DRAG);

	reporting = next;
};

const onData = (data: string | Buffer) => {
	for (const event of MouseUtils.parse(data.toString())) {
		// Copied, so a listener that unsubscribes mid-dispatch cannot break it.
		for (const listener of [...listeners]) listener(event);
	}
};

const stop = () => {
	if (!stream) return;
	stream.off("data", onData);
	stream = null;
	reporting = "none";
	process.stdout.write(MOTION_OFF + DRAG_OFF + TRACKING_OFF);
};

const subscribe = (
	input: NodeJS.ReadStream,
	listener: Listener,
	motion: boolean,
	drag: boolean,
) => {
	if (!stream) {
		stream = input;
		stream.on("data", onData);
		process.stdout.write(TRACKING);
	}

	listeners.add(listener);
	if (motion) motionListeners.add(listener);
	if (drag) dragListeners.add(listener);
	sync();
};

const unsubscribe = (listener: Listener) => {
	listeners.delete(listener);
	motionListeners.delete(listener);
	dragListeners.delete(listener);
	sync();

	if (listeners.size === 0) stop();
};

// Quitting through `process.exit` skips React cleanup, which would leave the
// terminal reporting every click long after the app is gone.
process.on("exit", stop);

/**
 * Subscribes to raw mouse events.
 */
export const useMouse = ({
	handler,
	motion = false,
	drag = false,
	isActive = true,
}: {
	handler: (event: MouseEvent) => void;
	motion?: boolean;
	/** Reports pointer moves made while a button is held. */
	drag?: boolean;
	isActive?: boolean;
}) => {
	const { stdin, setRawMode, isRawModeSupported } = useStdin();

	// Ink reads the input the mouse reports have already been taken out of, so
	// they are read from the terminal's own handle instead.
	const input = StdinUtils.source() ?? stdin;

	// Stable, so an inline handler does not resubscribe on every render.
	const listener = useEffectEvent(handler);

	useEffect(() => {
		if (!isActive || !input || !isRawModeSupported) return;

		setRawMode(true);
		subscribe(input, listener, motion, drag);

		return () => {
			unsubscribe(listener);
			setRawMode(false);
		};
	}, [input, setRawMode, isRawModeSupported, isActive, motion, drag]);
};
