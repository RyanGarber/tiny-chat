import { stripVTControlCharacters } from "node:util";
import ToolBlock from "#tui/features/part/components/ToolBlock.tsx";
import render from "#tui/tests.ts";

const block = {
	type: "web" as const,
	source: {
		url: "https://example.com/article",
		title: "Example article",
		content: "First paragraph.\n\nSecond paragraph with **emphasis**.",
	},
};

describe("web tool content", () => {
	it("shows the title, URL and full Markdown in copyable Content", async () => {
		const screen = await render(<ToolBlock block={block} active={false} />);
		try {
			const frame = stripVTControlCharacters(screen.lastFrame() ?? "");
			expect(frame).toContain(block.source.title);
			expect(frame).toContain(block.source.url);
			expect(frame).toContain("First paragraph.");
			expect(frame).toContain("Second paragraph with emphasis.");
			expect(frame).not.toContain("**emphasis**");
			expect(frame).toContain("copy");
			expect(frame.indexOf(block.source.url)).toBeLessThan(
				frame.indexOf("First paragraph."),
			);
		} finally {
			screen.unmount();
			screen.cleanup();
		}
	});

	it("does not offer copying while the content is active", async () => {
		const screen = await render(<ToolBlock block={block} active />);
		try {
			expect(screen.lastFrame()).toContain(block.source.title);
			expect(screen.lastFrame()).not.toContain("copy");
		} finally {
			screen.unmount();
			screen.cleanup();
		}
	});
});
