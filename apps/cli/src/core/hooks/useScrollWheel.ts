import { useStdin } from "ink";
import { type RefObject, useEffect } from "react";

export const useScrollWheel = ({
	scrollRef,
	step = 2,
}: {
	scrollRef: RefObject<any>;
	step?: number;
}) => {
	const { stdin, setRawMode, isRawModeSupported } = useStdin();

	useEffect(() => {
		if (!stdin || !isRawModeSupported) return;

		setRawMode(true);

		// 1000 = basic mouse tracking, 1006 = SGR extended coordinates
		process.stdout.write("\x1b[?1000h\x1b[?1006h");

		const onData = (data: string | Buffer<ArrayBuffer>) => {
			const str = data.toString();
			// biome-ignore lint/suspicious/noControlCharactersInRegex: terminal shit
			const match = str.match(/\x1b\[<(\d+);(\d+);(\d+)[Mm]/);
			if (!match) return;

			const button = parseInt(match[1], 10);
			if (button === 64) {
				scrollRef.current?.scrollBy(-step);
			} else if (button === 65) {
				scrollRef.current?.scrollBy(step);
			}
		};

		stdin.on("data", onData);

		return () => {
			process.stdout.write("\x1b[?1000l\x1b[?1006l");
			stdin.off("data", onData);
		};
	}, [stdin, setRawMode, isRawModeSupported, scrollRef, step]);
};
