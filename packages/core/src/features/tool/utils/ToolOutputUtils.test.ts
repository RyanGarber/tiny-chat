import { ToolOutputUtils } from "#core/features/tool/utils/ToolOutputUtils.ts";

describe("ToolOutputUtils.collect", () => {
	it("keeps everything while it fits", () => {
		const output = ToolOutputUtils.collect(10);
		output.push("hello ");
		output.push("world");
		expect(output.text()).toBe("hello world");
	});

	it("keeps the head and tail of output that never stops", () => {
		const output = ToolOutputUtils.collect(10);
		output.push("0123456789");
		for (let i = 0; i < 10_000; i++) output.push("x".repeat(100));
		output.push("abcdefghij");

		const text = output.text();
		expect(text.startsWith("0123456789\n[… ")).toBe(true);
		expect(text.endsWith("…]\nxxxxxxxxxxabcdefghij")).toBe(true);
		expect(text.length).toBeLessThan(100);
	});
});

describe("ToolOutputUtils.getPlain", () => {
	it("drops colour, cursor and title escapes", () => {
		expect(
			ToolOutputUtils.getPlain(
				"\u001B[1m\u001B[32m✓\u001B[39m passed\u001B[0m\u001B[?25l\u001B]0;title\u0007\u001B(B",
			),
		).toBe("✓ passed");
	});

	it("keeps lines, and only the last redraw of each", () => {
		expect(
			ToolOutputUtils.getPlain("one\r\n10%\r50%\r100%\ntwo\r\n\r\nthree"),
		).toBe("one\n100%\ntwo\n\nthree");
	});
});
