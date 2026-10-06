import { beforeEach, describe, expect, it } from "vitest";
import { HighlightService } from "#core/core/services/HighlightService.ts";

const SOURCE = `/**
 * A block comment that spans
 * several lines, so the grammar state matters.
 */
export const greet = (name: string) => {
	const template = \`hello \${name}
still inside the template\`;
	return template;
};

class Greeter {
	#name = "world";
}
`;

const highlight = (code: string, language = "typescript") =>
	HighlightService.highlight({ code, language, theme: "github-dark" });

describe("HighlightService", () => {
	beforeEach(() => {
		HighlightService.reset();
	});

	it("tokenizes a streamed snippet the same as all at once", async () => {
		const whole = await highlight(SOURCE);
		HighlightService.reset();

		for (let end = 1; end < SOURCE.length; end += 7) {
			const partial = await highlight(SOURCE.slice(0, end));
			HighlightService.reset();
			const cold = await highlight(SOURCE.slice(0, end));
			expect(partial).toEqual(cold);
		}
		HighlightService.reset();

		for (let end = 1; end < SOURCE.length; end += 7) {
			await highlight(SOURCE.slice(0, end));
		}
		expect(await highlight(SOURCE)).toEqual(whole);
	});

	it("continues from the longest earlier prefix", async () => {
		const whole = await highlight(SOURCE);
		HighlightService.reset();

		await highlight(SOURCE.slice(0, SOURCE.indexOf("export")));
		await highlight(SOURCE.slice(0, SOURCE.indexOf("class")));
		expect(await highlight(SOURCE)).toEqual(whole);
	});

	it("doesn't reuse a prefix the code no longer starts with", async () => {
		await highlight("const a = `\nopen template");
		const edited = await highlight("const a = 1;\nopen template");
		HighlightService.reset();
		expect(edited).toEqual(await highlight("const a = 1;\nopen template"));
	});

	it("falls back to plain text for unknown languages", async () => {
		const result = await highlight("just some words", "not-a-language");
		expect(result.tokens).toHaveLength(1);
		expect(result.tokens[0].map((token) => token.content).join("")).toBe(
			"just some words",
		);
	});

	it("returns only plain, cloneable token fields", async () => {
		const result = await highlight("const a = 1;");
		expect(structuredClone(result)).toEqual(result);
		expect(result).not.toHaveProperty("grammarState");
		expect(result.tokens[0][0]).toMatchObject({
			content: "const",
			offset: 0,
			htmlStyle: { color: expect.any(String) },
		});
	});
});
