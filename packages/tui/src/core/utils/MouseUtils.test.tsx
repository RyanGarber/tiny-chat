import { Box, type DOMElement, Text } from "ink";
import { createRef } from "react";
import stringWidth from "string-width";
import { describe, expect, it } from "vitest";
import Span from "#tui/core/components/Span.tsx";
import { MouseUtils } from "#tui/core/utils/MouseUtils.ts";
import { render } from "#tui/core/utils/RenderTestUtils.tsx";

const EMOJI = "🔗";

/** Where Ink actually drew the emoji, by searching the frame for it. */
const drawn = (frame: string) => {
	const lines = frame.split("\n");
	const y = lines.findIndex((line) => line.includes(EMOJI));
	const line = lines[y] ?? "";
	return { x: stringWidth(line.slice(0, line.indexOf(EMOJI))), y };
};

const locate = (before: string, after: string, width: number) => {
	const ref = createRef<DOMElement>();
	const { lastFrame } = render(
		<Box flexDirection="column" paddingLeft={2} width={width + 2}>
			<Text>header</Text>
			<Text>
				{before}
				<Span ref={ref}>
					<Text>{EMOJI}</Text>
				</Span>
				{after}
			</Text>
		</Box>,
	);
	const frame = lastFrame() ?? "";
	const rows = frame.split("\n").length;
	const node = ref.current;
	if (!node) throw new Error("no node");
	return { bounds: MouseUtils.textBounds(node, rows), frame };
};

describe("MouseUtils.textBounds", () => {
	it.each([
		["fits on one line", "short ", " end", 40],
		["wraps before it", "the quick brown fox jumps over the lazy ", " dog", 12],
		["starts a line", "aaaa bbbb ", " cccc dddd", 10],
		["after a hard-wrapped word", "abcdefghijklmnopqrstuvwxyz ", "", 8],
		["after a newline", "first line\nsecond ", " tail", 30],
	])("%s", (_name, before, after, width) => {
		const { bounds, frame } = locate(before, after, width);
		const { x, y } = drawn(frame);
		expect(bounds).toEqual({ x, y, width: 2, height: 1 });
	});
});
