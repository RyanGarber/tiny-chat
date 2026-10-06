import { useStdin, useStdout } from "ink";
import { useEffect, useEffectEvent } from "react";
import type { MouseEvent } from "#tui/core/utils/MouseUtils.ts";

// 1000 reports presses, 1006 uses SGR coordinates, 1002 adds dragging, and
// 1003 adds all pointer motion. Only request the widest mode still needed.
const TRACKING = "\x1b[?1000h\x1b[?1006h";
const TRACKING_OFF = "\x1b[?1006l\x1b[?1000l";
const DRAG = "\x1b[?1002h";
const DRAG_OFF = "\x1b[?1002l";
const MOTION = "\x1b[?1003h";
const MOTION_OFF = "\x1b[?1003l";

type Subscription = {
	listener: (event: MouseEvent) => void;
	motion: boolean;
	drag: boolean;
};
type Session = {
	stdin: NodeJS.ReadableStream;
	stdout: NodeJS.WritableStream;
	subscriptions: Set<Subscription>;
	reporting: "none" | "drag" | "motion";
	dispatch: (event: MouseEvent) => void;
};

const sessions = new Set<Session>();

const sync = (session: Session) => {
	const subscriptions = [...session.subscriptions];
	const next = subscriptions.some((item) => item.motion)
		? "motion"
		: subscriptions.some((item) => item.drag)
			? "drag"
			: "none";
	if (next === session.reporting) return;
	if (session.reporting === "motion") session.stdout.write(MOTION_OFF);
	else if (session.reporting === "drag") session.stdout.write(DRAG_OFF);
	if (next === "motion") session.stdout.write(MOTION);
	else if (next === "drag") session.stdout.write(DRAG);
	// Tracking modes are mutually exclusive on xterm-compatible terminals.
	// Turning motion off does not restore the previously enabled click mode.
	else session.stdout.write(TRACKING);
	session.reporting = next;
};

const stop = (session: Session) => {
	session.stdin.off("mouse", session.dispatch);
	session.stdout.write(MOTION_OFF + DRAG_OFF + TRACKING_OFF);
	sessions.delete(session);
	if (!sessions.size) process.off("exit", stopAll);
};

// process.exit skips React cleanup. Do not leave the shell reporting clicks.
const stopAll = () => {
	for (const session of sessions) stop(session);
};

const subscribe = (
	stdin: NodeJS.ReadableStream,
	stdout: NodeJS.WritableStream,
	subscription: Subscription,
) => {
	let session = [...sessions].find(
		(item) => item.stdin === stdin && item.stdout === stdout,
	);
	if (!session) {
		const subscriptions = new Set<Subscription>();
		session = {
			stdin,
			stdout,
			subscriptions,
			reporting: "none",
			dispatch: (event) => {
				for (const item of [...subscriptions]) item.listener(event);
			},
		};
		if (!sessions.size) process.on("exit", stopAll);
		sessions.add(session);
		stdin.on("mouse", session.dispatch);
		stdout.write(TRACKING);
	}
	session.subscriptions.add(subscription);
	sync(session);
	return () => {
		session.subscriptions.delete(subscription);
		if (!session.subscriptions.size) stop(session);
		else sync(session);
	};
};

/** Subscribes to reports decoded by the stdin adapter, never keyboard text. */
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
	const { stdout } = useStdout();
	const listener = useEffectEvent(handler);

	useEffect(() => {
		if (!isActive || !isRawModeSupported) return;
		// biome-ignore lint/nursery/useReactCompiler: setRawMode controls Ink's external terminal input mode, not React state.
		setRawMode(true);
		const unsubscribe = subscribe(stdin, stdout, { listener, motion, drag });
		return () => {
			unsubscribe();
			setRawMode(false);
		};
	}, [stdin, stdout, setRawMode, isRawModeSupported, isActive, motion, drag]);
};
