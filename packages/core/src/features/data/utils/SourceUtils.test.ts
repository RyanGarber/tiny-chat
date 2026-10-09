import type { Source } from "#core/features/data/utils/SourceUtils.ts";
import { SourceUtils } from "#core/features/data/utils/SourceUtils.ts";

const file = (key: string): Source => ({
	key,
	type: "file",
	value: { path: key, directory: false },
});

describe("SourceUtils", () => {
	const sources = [
		file("/notes/project plan.md"),
		file("/notes/project status.md"),
		file("alpha123"),
		file("beta456"),
	];

	it("prefers a complete key containing spaces", () => {
		expect(
			SourceUtils.matchKeys({ sources, keys: "/notes/project plan.md" }),
		).toEqual(["/notes/project plan.md"]);
	});

	it("fuzzy matches the complete key before splitting it", () => {
		expect(
			SourceUtils.matchKeys({ sources, keys: "/notes/project plam.md" }),
		).toEqual(["/notes/project plan.md"]);
	});

	it("tries the entire string before treating punctuation as separators", () => {
		const punctuationSource = file("/notes/plan, final.md");
		expect(
			SourceUtils.matchKeys({
				sources: [...sources, punctuationSource],
				keys: "/notes/plan, final.md",
			}),
		).toEqual(["/notes/plan, final.md"]);
	});

	it("falls back to multiple whitespace-separated keys", () => {
		expect(
			SourceUtils.matchKeys({ sources, keys: "alpha123 beta456" }),
		).toEqual(["alpha123", "beta456"]);
	});

	it("consumes the longest matching spans among multiple keys", () => {
		expect(
			SourceUtils.matchKeys({
				sources,
				keys: "/notes/project plan.md beta456",
			}),
		).toEqual(["/notes/project plan.md", "beta456"]);
	});

	it("keeps unknown pieces so callers can render missing sources", () => {
		expect(
			SourceUtils.matchKeys({ sources, keys: "unknown alpha123; missing" }),
		).toEqual(["unknown", "alpha123", "missing"]);
	});

	it("expands a cited call ID to the sources the call produced", () => {
		const produced: Source[] = [
			{ ...file("/a.md"), call: "toolu_01search" },
			{ ...file("/b.md"), call: "toolu_01search" },
		];
		expect(
			SourceUtils.matchKeys({
				sources: [...sources, ...produced],
				keys: "toolu_01search alpha123 /a.md",
			}),
		).toEqual(["/a.md", "/b.md", "alpha123"]);
	});

	it("falls back to the tool call for a call without supported results", () => {
		const found = SourceUtils.find({
			message: {
				data: [
					[
						{
							id: "call_1",
							type: "toolCall",
							name: "lookup_weather",
							input: { city: "Paris" },
						},
						{
							id: "call_1",
							type: "toolResult",
							name: "lookup_weather",
							output: [{ id: "out_1", type: "text", value: "Sunny" }],
						},
					],
				],
			},
			toolsets: [],
		});
		expect(found).toEqual([
			{
				key: "call_1",
				call: "call_1",
				type: "toolCall",
				value: { id: "call_1", title: "Used lookup_weather", error: false },
			},
		]);
		expect(
			SourceUtils.getDisplay({ sources: found, key: "call_1", text: "" }),
		).toMatchObject({ type: "toolCall", emoji: "🔧" });
	});
});
