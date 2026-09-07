import { SearchUtils } from "./SearchUtils.ts";

describe("SearchUtils", () => {
	it("normalizes and deduplicates transcript words", () => {
		expect(SearchUtils.lexicalText("Orchid ORCHID orchid! ".repeat(3000))).toBe(
			"orchid",
		);
		expect(SearchUtils.lexicalText("café, 東京! 42 a")).toBe("café 東京 42 a");
		expect(SearchUtils.lexicalText("   !? ")).toBe("");
	});
	it("bounds distinct terms and skips oversized payloads", () => {
		const words = Array.from({ length: 1000 }, (_, i) => `word${i}`);
		expect(SearchUtils.lexicalText(words.join(" "))).toBe(
			words.slice(0, 32).join(" "),
		);
		expect(SearchUtils.lexicalText(`${"x".repeat(10000)} orchid`)).toBe(
			"orchid",
		);
	});
	it("rewards independent agreement without counting fuzzy overlap twice", () => {
		const exact = [{ id: "agreement" }, { id: "exact" }];
		const fuzzy = [{ id: "typo" }, ...exact];
		const ranked = SearchUtils.fuse(exact, fuzzy, [{ id: "agreement" }]);
		expect(ranked.map((row) => row.id)).toEqual(["agreement", "exact", "typo"]);
		expect(ranked[1].score).toBe(1 / 32);
	});
	it("only fuzzes sufficiently long words", () => {
		expect(SearchUtils.fuzzyText("is it a chrysanthemun?")).toBe(
			"chrysanthemun",
		);
		expect(SearchUtils.fuzzyText("a b c")).toBe("");
	});
});
