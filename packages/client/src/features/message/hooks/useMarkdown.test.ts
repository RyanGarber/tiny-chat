import { describe, expect, it } from "vitest";
import { processor } from "./useMarkdown.ts";

type Slim = string | [string, ...Slim[]];

const slim = (node: {
	type: string;
	name?: string;
	tagName?: string;
	value?: string;
	children?: Array<typeof node>;
}): Slim => {
	if (node.type === "text") return node.value ?? "";
	const name = node.tagName ?? node.name ?? node.type;
	return [name, ...(node.children?.map(slim) ?? [])];
};

const parse = (source: string) => slim(processor.parse(source));
const run = (source: string) =>
	slim(processor.runSync(processor.parse(source)));

describe("markdown directives", () => {
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

	it("still parses real directives", () => {
		expect(parse(':command[hi]{name="x"}')).toEqual([
			"root",
			["paragraph", ["command", "hi"]],
		]);
		expect(parse(':attachment[]{source="a"}')).toEqual([
			"root",
			["paragraph", ["attachment"]],
		]);
		expect(parse("::command[hi]")).toEqual(["root", ["command", "hi"]]);
		expect(parse(":::quote\nhi\n:::")).toEqual([
			"root",
			["quote", ["paragraph", "hi"]],
		]);
		expect(parse(':::paste{lines="3"}\n```\na\nb\nc\n```\n:::')).toEqual([
			"root",
			["paste", ["code"]],
		]);
		expect(run(':::paste{lines="3"}\n```\na\nb\nc\n```\n:::')).toEqual([
			"root",
			["details", ["pre", ["code", "a\nb\nc\n"]]],
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
