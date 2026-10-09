import { describe, expect, it } from "vitest";
import type { FindBlock } from "#client/features/find/types/find.ts";
import { FindUtils } from "#client/features/find/utils/FindUtils.ts";

const block = (...texts: string[]): FindBlock<string> =>
	texts.map((text, i) => ({ node: `${texts.join("|")}#${i}`, text }));

describe("FindUtils.search", () => {
	it("finds every match in reading order, ignoring case", () => {
		const matches = FindUtils.search(
			[block("Foo bar foo"), block("FOO")],
			"foo",
		);
		expect(matches.map((m) => [m.start.node, m.start.offset])).toEqual([
			["Foo bar foo#0", 0],
			["Foo bar foo#0", 8],
			["FOO#0", 0],
		]);
	});

	it("matches across the pieces of a block", () => {
		// Code split into tokens by its highlighting.
		const [match] = FindUtils.search(
			[block("const ", "use", "State", "(0)")],
			"useState(",
		);
		expect(match.start).toEqual({ node: "const |use|State|(0)#1", offset: 0 });
		expect(match.end).toEqual({ node: "const |use|State|(0)#3", offset: 1 });
		expect(match.pieces.map((p) => [p.start, p.end])).toEqual([
			[0, 3],
			[0, 5],
			[0, 1],
		]);
	});

	it("never matches from one block into the next", () => {
		expect(
			FindUtils.search([block("end"), block("start")], "endstart"),
		).toEqual([]);
	});

	it("treats the query as text, not a pattern", () => {
		expect(FindUtils.search([block("a.b axb (x)")], "a.b")).toHaveLength(1);
		expect(FindUtils.search([block("a.b axb (x)")], "(x)")).toHaveLength(1);
	});

	it("keeps offsets where lowercasing would change the length", () => {
		const [match] = FindUtils.search([block("İstanbul x")], "x");
		expect(match.start.offset).toBe(9);
	});

	it("respects case sensitivity and the limit", () => {
		expect(
			FindUtils.search([block("Foo foo")], "foo", { caseSensitive: true }),
		).toHaveLength(1);
		expect(FindUtils.search([block("aaaa")], "a", { limit: 2 })).toHaveLength(
			2,
		);
	});
});
