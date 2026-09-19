import { MarkdownUtils } from "./MarkdownUtils.ts";

/**
 * The label every character ends up under, resolved the way the text area
 * resolves it: the rules are read in order and the first one to claim a
 * character keeps it.
 */
const paint = (value: string) => {
	const painted: string[] = new Array(value.length).fill("text");

	for (const rule of MarkdownUtils.labels()) {
		for (const match of value.matchAll(rule.pattern)) {
			const start = match.index ?? 0;
			const label =
				typeof rule.label === "string" ? rule.label : rule.label(match);
			if (!label) continue;

			for (let index = start; index < start + match[0].length; index++) {
				if (painted[index] === "text") painted[index] = label;
			}
		}
	}

	return painted;
};

/** The text claimed under a label, as one string per run of it. */
const claimed = (value: string, label: string) => {
	const painted = paint(value);
	const runs: string[] = [];

	for (const [index, character] of [...value].entries()) {
		if (painted[index] !== label) continue;
		if (painted[index - 1] === label) runs[runs.length - 1] += character;
		else runs.push(character);
	}

	return runs;
};

describe("MarkdownUtils.labels", () => {
	it("styles a span and the markers holding it apart", () => {
		expect(claimed("a **bold** b", "markdownBold")).toEqual(["bold"]);
		expect(claimed("a **bold** b", "markdownBoldMarker")).toEqual(["**", "**"]);

		expect(claimed("a *slanted* b", "markdownItalic")).toEqual(["slanted"]);
		expect(claimed("a *slanted* b", "markdownItalicMarker")).toEqual([
			"*",
			"*",
		]);

		expect(claimed("a _slanted_ b", "markdownItalic")).toEqual(["slanted"]);
		expect(claimed("a ~~gone~~ b", "markdownStrike")).toEqual(["gone"]);
		expect(claimed("a `read()` b", "markdownInlineCode")).toEqual(["read()"]);
	});

	it("leaves markers that hold nothing apart alone", () => {
		expect(claimed("2 * 3 * 4", "markdownItalic")).toEqual([]);
		expect(claimed("a ** b", "markdownBoldMarker")).toEqual([]);
		expect(claimed("snake_case_name", "markdownItalic")).toEqual([]);
		expect(claimed("a * b\nc * d", "markdownItalicMarker")).toEqual([]);
	});

	it("reads the bold marker before the italic one inside it", () => {
		expect(claimed("**both**", "markdownItalicMarker")).toEqual([]);
	});

	it("claims a fenced block whole, markdown inside it and all", () => {
		const value = "```ts\nconst a = **b**;\n```";

		expect(claimed(value, "markdownCodeFence")).toEqual(["```ts", "```"]);
		// The newlines holding the body apart from its fences belong to the block.
		expect(claimed(value, "markdownCode")).toEqual(["\nconst a = **b**;\n"]);
		expect(claimed(value, "markdownBold")).toEqual([]);
	});

	it("claims a fence that is still open through to the end", () => {
		expect(claimed("```\nstill **writing**", "markdownBold")).toEqual([]);
	});

	it("styles the lines a construct takes whole", () => {
		expect(claimed("## Title", "markdownHeadingMarker")).toEqual(["##"]);
		expect(claimed("## Title", "markdownHeading")).toEqual([" Title"]);

		expect(claimed("> said", "markdownQuoteMarker")).toEqual(["> "]);
		expect(claimed("> said", "markdownQuote")).toEqual(["said"]);

		expect(claimed("- one\n- two", "markdownBullet")).toEqual(["-", "-"]);
		expect(claimed("1. one\n2. two", "markdownBullet")).toEqual(["1.", "2."]);
		expect(claimed("- [x] done", "markdownTask")).toEqual(["[x]"]);
		expect(claimed("---", "markdownRule")).toEqual(["---"]);
	});

	it("leaves the markup inside a quote its own style", () => {
		expect(claimed("> a **bold** word", "markdownBold")).toEqual(["bold"]);
	});

	it("styles a link and its target apart", () => {
		const value = "see [docs](https://x.dev) now";

		expect(claimed(value, "markdownLinkText")).toEqual(["[docs]"]);
		expect(claimed(value, "markdownLinkUrl")).toEqual(["(https://x.dev)"]);
	});

	it("draws every label it paints under", () => {
		const styles = MarkdownUtils.styles({
			surface: "#000",
			interior: "#111",
			exterior: "#222",
			border: "#333",
			borderSubtle: "#444",
			text: "#fff",
			textSubtle: "#aaa",
			primary: "#1194ff",
		});

		for (const rule of MarkdownUtils.labels()) {
			if (typeof rule.label !== "string") continue;
			expect(styles[rule.label], rule.label).toBeDefined();
		}
	});
});

describe("MarkdownUtils.marked", () => {
	/** The content with the cursor drawn into it, which reads as the editor does. */
	const mark = (drawn: string, marker: string) => {
		const offset = drawn.indexOf("|");
		const value = drawn.replace("|", "");
		const write = MarkdownUtils.marked({ value, offset, marker });
		if (!write) return null;

		return `${write.content.slice(0, write.offset)}|${write.content.slice(write.offset)}`;
	};

	it("closes a span as it is opened", () => {
		expect(mark("|", "*")).toBe("*|*");
		expect(mark("a |", "`")).toBe("a `|`");
		expect(mark("a |", "~")).toBe("a ~|~");
	});

	it("turns a second marker at the opening into a wider one", () => {
		expect(mark("*|*", "*")).toBe("**|**");
		expect(mark("`|`", "`")).toBe("``|``");
		expect(mark("~|~", "~")).toBe("~~|~~");
	});

	it("steps over the marker already closing the span", () => {
		expect(mark("*slanted|*", "*")).toBe("*slanted*|");
		expect(mark("**bold|**", "*")).toBe("**bold*|*");
		expect(mark("**bold*|*", "*")).toBe("**bold**|");
	});

	it("leaves a word being marked up from its left to be written as typed", () => {
		expect(mark("|word", "*")).toBe(null);
	});

	it("leaves anything that is not a marker to be written as typed", () => {
		expect(mark("a|", "b")).toBe(null);
		expect(mark("a|", "-")).toBe(null);
	});
});

describe("MarkdownUtils.broken", () => {
	/** The content with the cursor drawn into it, as above. */
	const open = (drawn: string) => {
		const offset = drawn.indexOf("|");
		const value = drawn.replace("|", "");
		const write = MarkdownUtils.broken({ value, offset });
		if (!write) return null;

		return `${write.content.slice(0, write.offset)}|${write.content.slice(write.offset)}`;
	};

	it("carries a list on, numbering it as it goes", () => {
		expect(open("- one|")).toBe("- one\n- |");
		expect(open("* one|")).toBe("* one\n* |");
		expect(open("  - one|")).toBe("  - one\n  - |");
		expect(open("1. one|")).toBe("1. one\n2. |");
		expect(open("3) one|")).toBe("3) one\n4) |");
	});

	it("carries a task on as one still to do", () => {
		expect(open("- [x] done|")).toBe("- [x] done\n- [ ] |");
	});

	it("carries a quote on", () => {
		expect(open("> said|")).toBe("> said\n> |");
		expect(open("> - said|")).toBe("> - said\n> - |");
	});

	it("ends a block that nothing was written into", () => {
		expect(open("- one\n- |")).toBe("- one\n|");
		expect(open("> |")).toBe("|");
	});

	it("breaks a fence open around the cursor", () => {
		expect(open("```ts|```")).toBe("```ts\n|\n```");
		expect(open("```|```")).toBe("```\n|\n```");
	});

	it("leaves a plain line to be written as typed", () => {
		expect(open("a plain line|")).toBe(null);
		expect(open("|")).toBe(null);
	});
});
