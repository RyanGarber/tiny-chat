import { stripVTControlCharacters } from "node:util";
import type { Source } from "@tiny-chat/core/features/data/utils/SourceUtils.ts";
import { Box, Text, useWindowSize } from "ink";
import stringWidth from "string-width";
import { expect, it } from "vitest";
import { render } from "../../../core/utils/RenderTestUtils.tsx";
import { Citation, CitationCard } from "./Citation.tsx";

const sources: Source[] = [
	{
		key: "https://example.com/article",
		type: "web",
		value: {
			url: "https://example.com/article",
			title: "An Example Article",
			content: "Some content about the quick brown fox.",
		},
	},
];

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

/** An SGR press and release at a cell, counted from 0. */
const click = (x: number, y: number) =>
	`\x1b[<0;${x + 1};${y + 1}M\x1b[<0;${x + 1};${y + 1}m`;

/** Fills the terminal, as the app does, so frame rows are screen rows. */
function Screen() {
	const { rows } = useWindowSize();
	return (
		<Box flexDirection="column" height={rows} width={40}>
			<Text>
				the quick brown fox jumps over the lazy dog
				<Citation
					sourceKey="https://example.com/article"
					sources={sources}
					cited="quick brown fox"
				/>
			</Text>
			<CitationCard />
		</Box>
	);
}

it("opens the card on a click on the emoji, and closes it on one elsewhere", async () => {
	const screen = render(<Screen />);
	await settle();

	const frame = () => stripVTControlCharacters(screen.lastFrame() ?? "");
	const lines = frame().split("\n");
	const y = lines.findIndex((line) => line.includes("🔗"));
	const x = stringWidth(lines[y]?.slice(0, lines[y]?.indexOf("🔗")) ?? "");
	expect(frame()).not.toContain("An Example Article");

	screen.stdin.write(click(x + 1, y));
	await settle();
	expect(frame()).toContain("An Example Article");
	expect(frame()).toContain("https://example.com/article");

	screen.stdin.write(click(0, frame().split("\n").length - 1));
	await settle();
	expect(frame()).not.toContain("An Example Article");

	screen.unmount();
	screen.cleanup();
});
