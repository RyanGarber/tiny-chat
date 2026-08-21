import { describe, expect, it } from "vitest";
import { type MarkdownBlocks, MarkdownUtils } from "./MarkdownUtils.ts";

const split = (content: string, previous?: MarkdownBlocks) =>
	MarkdownUtils.split({ content, previous });

const documents = {
	prose: `# Title\n\nA paragraph with **bold** text.\n\nAnother paragraph.\n`,
	lists: `1. one\n   - nested\n2. two\n\n   loose item body\n\n3. three\n\n- [ ] todo\n`,
	code: `Intro:\n\n\`\`\`ts\nconst a = 1;\n\nconst b = 2;\n\`\`\`\n\nOutro.\n`,
	table: `| a | b |\n| --- | --- |\n| 1 | 2 |\n\nAfter.\n`,
	directive: `:::quote{model="gpt"}\nQuoted **body**.\n\nSecond paragraph.\n:::\n\nAfter.\n`,
	setext: `A paragraph\n---\n\nAnother one\n===\n`,
	quote: `> one\n>\n> two\n\n---\n\nAfter the rule.\n`,
	math: `Before.\n\n$$\nx = 1\n$$\n\nAfter.\n`,
	separate: `- one\n\n- two\n\n- three\n\ntext\n\n1. a\n\n1. b\n`,
	quotes: `> one\n\n> two\n\n- item\n\n> three\n`,
	nested: `- outer\n\n  - inner one\n\n  - inner two\n\n    body\n\n- outer two\n`,
	mixed: `## Head\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n> quote\n\n\`\`\`\ncode\n\`\`\`\n\n- item\n- item\n\nEnd.\n`,
};

describe("split", () => {
	it("cuts a document into its top-level blocks", () => {
		expect(split(documents.prose).blocks).toEqual([
			"# Title",
			"A paragraph with **bold** text.",
			"Another paragraph.",
		]);
	});

	it("keeps constructs that span blank lines in one block", () => {
		expect(split(documents.lists).blocks).toEqual([
			"1. one\n   - nested\n2. two\n\n   loose item body\n\n3. three",
			"- [ ] todo",
		]);
		expect(split(documents.code).blocks).toEqual([
			"Intro:",
			"```ts\nconst a = 1;\n\nconst b = 2;\n```",
			"Outro.",
		]);
		expect(split(documents.directive).blocks).toEqual([
			':::quote{model="gpt"}\nQuoted **body**.\n\nSecond paragraph.\n:::',
			"After.",
		]);
	});

	it("refuses to split what a block cannot resolve on its own", () => {
		for (const content of [
			`See [one].\n\n[one]: https://example.com\n`,
			`A note[^a].\n\n[^a]: the body\n`,
			`<div>\n\nwrapped\n\n</div>\n`,
		]) {
			const result = split(content);
			expect(result.split).toBe(false);
			expect(result.blocks).toEqual([content]);
		}
	});

	it("matches a full split at every point of a stream", () => {
		for (const [name, document] of Object.entries(documents)) {
			let previous: MarkdownBlocks | undefined;

			for (let length = 1; length <= document.length; length++) {
				const content = document.slice(0, length);
				previous = split(content, previous);

				expect(previous.blocks, `${name} at ${length}`).toEqual(
					split(content).blocks,
				);
			}
		}
	});

	it("reuses the blocks it has already cut", () => {
		const first = split("First one.\n\nSecond one.");
		const second = split("First one.\n\nSecond one. And more.", first);

		expect(second.blocks[0]).toBe(first.blocks[0]);
		expect(split(second.content, second)).toBe(second);
	});
});
