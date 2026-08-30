import { describe, expect, it } from "vitest";
import { MarkdownPreprocessorUtils } from "./MarkdownPreprocessorUtils.ts";

const preprocess = MarkdownPreprocessorUtils.preprocess;

describe("MarkdownPreprocessorUtils", () => {
	it("ends a blockquote before an unmarked continuation", () => {
		expect(preprocess("> quoted\nnot quoted")).toBe("> quoted\n\nnot quoted");
	});

	it("keeps explicitly marked and already separated lines unchanged", () => {
		expect(preprocess("> one\n> two\n\nthree")).toBe("> one\n> two\n\nthree");
	});

	it("preserves line endings", () => {
		expect(preprocess("> quoted\r\nnot quoted")).toBe(
			"> quoted\r\n\r\nnot quoted",
		);
	});

	it("does not rewrite blockquote-like text in fenced code", () => {
		const markdown = "```markdown\n> quoted\nnot quoted\n```";
		expect(preprocess(markdown)).toBe(markdown);
	});
});
