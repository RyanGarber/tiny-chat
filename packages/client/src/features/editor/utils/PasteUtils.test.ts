import { describe, expect, it } from "vitest";
import { PASTE_LINE_LIMIT, PasteUtils } from "./PasteUtils.ts";

const long = (line: string, count = PASTE_LINE_LIMIT) =>
	Array.from({ length: count }, () => line).join("\n");

describe("PasteUtils", () => {
	it("treats 10 or more lines as long", () => {
		expect(PasteUtils.isLong("a\nb\nc")).toBe(false);
		expect(PasteUtils.isLong(long("line", 9))).toBe(false);
		expect(PasteUtils.isLong(long("line", 10))).toBe(true);
	});

	it("wraps a long paste as a paste directive around a fence", () => {
		const text = long("hello");
		expect(PasteUtils.markdown(text)).toBe(
			`:::paste{lines="10"}\n${PasteUtils.fence(text)}\n:::`,
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
				"# Title\n\nA paragraph with **bold** and a [link](https://example.com).\n",
			),
		).toBeNull();
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
