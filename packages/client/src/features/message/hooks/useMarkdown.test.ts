import { _useMarkdownTest } from "#client/features/message/hooks/useMarkdown.ts";
import { MarkdownUtils } from "#client/features/message/utils/MarkdownUtils.ts";
import {
	EditorPartUtils,
	type zEditorPart,
} from "#core/features/data/utils/EditorPartUtils.ts";

const { parse, run } = _useMarkdownTest();

describe("useMarkdown", () => {
	it("does not treat ratios or IPv6 as directives", () => {
		expect(parse("before 1:1 after")).toEqual([
			"root",
			["paragraph", "before 1:1 after"],
		]);
		expect(parse("before *1:1 clones* of each other")).toEqual([
			"root",
			["paragraph", "before ", ["emphasis", "1:1 clones"], " of each other"],
		]);
		expect(parse("::1")).toEqual(["root", ["paragraph", "::1"]]);
		expect(parse(":::1\nhi\n:::")).toEqual([
			"root",
			["paragraph", ":::1\nhi\n:::"],
		]);
	});

	it("does not let a ratio split a paragraph into a div", () => {
		expect(run("before *1:1 clones* of each other")).toEqual([
			"root",
			["p", "before ", ["em", "1:1 clones"], " of each other"],
		]);
	});

	it("still parses the directives a model writes", () => {
		expect(parse(":::writing\nhi\n:::")).toEqual([
			"root",
			["writing", ["paragraph", "hi"]],
		]);
		expect(run(":::writing\nhi\n:::")).toEqual([
			"root",
			["blockquote", ["p", "hi"]],
		]);
	});

	it("requires [] on text directives", () => {
		expect(parse(':command{name="x"}')).toEqual([
			"root",
			["paragraph", ':command{name="x"}'],
		]);
		expect(parse(":quote")).toEqual(["root", ["paragraph", ":quote"]]);
	});
});

describe("editor parts", () => {
	const m = EditorPartUtils.marker;
	const attachment: zEditorPart = {
		id: "a",
		type: "attachment",
		source: "/project/a.ts",
		label: "a.ts",
		content: { type: "unavailable" },
	};
	const prose = "`Customer[Page]` renamed.\n\nExamples:\n- A -> B\n- C -> D";
	const paste: zEditorPart = {
		id: "p",
		type: "paste",
		text: prose,
		lines: 5,
		language: null,
		collapsed: true,
	};

	it("draws an inline part where its marker stands", () => {
		expect(run(`see **${m(0)}** now`, [attachment])).toEqual([
			"root",
			["p", "see ", ["strong", ["link"]], " now"],
		]);
	});

	it("lifts a block part out of the paragraph it landed in", () => {
		expect(run(`look:\n${m(0)}\nthanks`, [paste])).toEqual([
			"root",
			["p", "look:"],
			[
				"details",
				["p", ["code", "Customer[Page]"], " renamed."],
				["p", "Examples:"],
				["ul", ["li", "A -> B"], ["li", "C -> D"]],
			],
			["p", "thanks"],
		]);
	});

	it("draws a pasted source as code", () => {
		expect(run(m(0), [{ ...paste, text: "a\n\nb", language: "ts" }])).toEqual([
			"root",
			["details", ["pre", ["code", "a\n\nb\n"]]],
		]);
	});

	it("keeps one block when a paste is split from the rest", () => {
		const content = `${m(0)}\n\nafter`;
		expect(MarkdownUtils.split({ content }).blocks).toEqual([m(0), "after"]);
	});

	it("writes a part in code as the text it would have been typed as", () => {
		expect(run(`\`${m(0)}\``, [attachment])).toEqual([
			"root",
			["p", ["code", "@a.ts"]],
		]);
	});
});
