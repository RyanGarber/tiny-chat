import { describe, expect, it } from "vitest";
import {
	PASTE_LINE_LIMIT,
	PASTE_NEWLINE_LIMIT,
	PasteUtils,
} from "./PasteUtils.ts";

const long = (line: string, count = PASTE_LINE_LIMIT) =>
	Array.from({ length: count }, () => line).join("\n");

describe("PasteUtils", () => {
	it("only treats 10 or more genuine newlines as long", () => {
		expect(PasteUtils.isLong("a\nb\nc")).toBe(false);
		expect(PasteUtils.isLong(long("line", PASTE_NEWLINE_LIMIT))).toBe(false);
		expect(PasteUtils.isLong(long("line", PASTE_LINE_LIMIT))).toBe(true);
		expect(PasteUtils.isLong("a\r\nb\r\n")).toBe(false);
	});

	it("wraps a long paste as a paste directive around a fence", () => {
		const text = long("hello");
		expect(PasteUtils.markdown(text)).toBe(
			`:::paste{lines="${PASTE_LINE_LIMIT}"}\n${PasteUtils.fence(text)}\n:::`,
		);
	});

	it("detects source as code and leaves prose and lists alone", () => {
		expect(
			PasteUtils.detectCode(
				'const x = 1;\nconst y = 2;\nconsole.log(x + y);\n\n{\n  "a": 1,\n  "b": [2, 3]\n}\n\ndef foo():\n    return 1\n\nprint(foo())\n\n',
			),
		).toEqual({ language: expect.any(String) });

		expect(
			PasteUtils.detectCode(
				"Hello there,\n\nJust wanted to say thanks for the help yesterday.",
			),
		).toBeNull();
		expect(PasteUtils.detectCode("- milk\n- eggs\n- bread")).toBeNull();
		expect(PasteUtils.detectCode("https://example.com/path")).toBeNull();
		expect(
			PasteUtils.detectCode(
				"This is where we met.\nI remember where the entrance was.\nIt was a fairly ordinary day.",
			),
		).toBeNull();
		expect(
			PasteUtils.detectCode(
				"# Title\n\nA paragraph with **bold** and a [link](https://example.com).\n",
			),
		).toBeNull();
	});

	it("detects short multiline snippets from syntax rather than length", () => {
		expect(
			PasteUtils.detectCode("const answer = 42;\nreturn answer;"),
		).not.toBeNull();
		expect(
			PasteUtils.detectCode("def answer():\n    return 42"),
		).not.toBeNull();
		expect(PasteUtils.detectCode("SELECT id\nFROM users")).not.toBeNull();
	});

	it("treats an already-fenced paste as code", () => {
		expect(PasteUtils.detectCode("```ts\nconst x = 1;\n```")).toEqual({
			language: "typescript",
		});
		expect(PasteUtils.unwrapFence("```js\nconst x = 1;\n```")).toEqual({
			language: "js",
			text: "const x = 1;",
		});
	});

	it("lengthens the fence when the paste contains backticks", () => {
		expect(PasteUtils.fence("```\ninner\n```")).toBe(
			"````\n```\ninner\n```\n````",
		);
	});
});
