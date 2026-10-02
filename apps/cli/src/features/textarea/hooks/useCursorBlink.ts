import { useEffect, useRef, useState } from "react";

/** How long the cursor stays on, and then off. */
const INTERVAL = 500;

/** How long the cursor holds still after a keystroke before it blinks again. */
const TYPING_PAUSE = 450;

/** A blinking cursor, held on while it is being moved and typed at. */
export const useCursorBlink = (isActive: boolean) => {
	const [isVisible, setIsVisible] = useState(true);

	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const clear = () => {
		if (intervalRef.current) clearInterval(intervalRef.current);
		if (timeoutRef.current) clearTimeout(timeoutRef.current);
		intervalRef.current = null;
		timeoutRef.current = null;
	};

	const blink = () => {
		intervalRef.current = setInterval(
			() => setIsVisible((visible) => !visible),
			INTERVAL,
		);
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: the timers are held in refs
	useEffect(() => {
		if (!isActive) return;

		blink();
		return clear;
	}, [isActive]);

	/** Shows the cursor and holds it there until typing pauses. */
	const hold = () => {
		setIsVisible(true);
		clear();
		timeoutRef.current = setTimeout(() => {
			timeoutRef.current = null;
			blink();
		}, TYPING_PAUSE);
	};

	// Held on while it is not blinking at all.
	return { isVisible: !isActive || isVisible, hold };
};
