import { useStdin } from "ink";
import type { ScrollViewRef } from "ink-scroll-view";
import { type RefObject, useEffect } from "react";

export const useScrollWheel = ({
	scrollRef,
	step = 2,
}: {
	scrollRef: RefObject<ScrollViewRef | null>;
	step?: number;
}) => {
	const { stdin, setRawMode, isRawModeSupported } = useStdin();

	useEffect(() => {
		if (!stdin || !isRawModeSupported) return;

		setRawMode(true);

		// 1000 = basic mouse tracking, 1006 = SGR extended coordinates
		process.stdout.write("\x1b[?1000h\x1b[?1006h");

		const scrollBy = (delta: number) => {
			const view = scrollRef.current;
			if (!view) return;
			// Scrolling past the last row collapses the measured viewport, which
			// leaves the view stuck on a blank screen.
			const offset = view.getScrollOffset() + delta;
			view.scrollTo(Math.max(0, Math.min(offset, view.getBottomOffset())));
		};

		const onData = (data: string | Buffer<ArrayBuffer>) => {
			const str = data.toString();
			// biome-ignore lint/suspicious/noControlCharactersInRegex: terminal shit
			const match = str.match(/\x1b\[<(\d+);(\d+);(\d+)[Mm]/);
			if (!match) return;

			const button = parseInt(match[1], 10);
			if (button === 64) {
				scrollBy(-step);
			} else if (button === 65) {
				scrollBy(step);
			}
		};

		stdin.on("data", onData);

		return () => {
			process.stdout.write("\x1b[?1000l\x1b[?1006l");
			stdin.off("data", onData);
		};
	}, [stdin, setRawMode, isRawModeSupported, scrollRef, step]);
};
