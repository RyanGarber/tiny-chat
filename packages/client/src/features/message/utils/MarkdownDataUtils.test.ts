import { _useMarkdownTest } from "../hooks/useMarkdown.ts";
import {
	type AttachmentPart,
	useMarkdownDataStore,
} from "../stores/useMarkdownDataStore.ts";
import { MarkdownDataUtils } from "./MarkdownDataUtils.ts";

const { run } = _useMarkdownTest();

const attachment: AttachmentPart = {
	id: "attachment-1",
	type: "attachment",
	source: "/notes.txt",
	label: "notes.txt",
	content: { type: "file", mime: "text/plain", data: "bm90ZXM=" },
};

describe("MarkdownDataUtils", () => {
	beforeEach(() => useMarkdownDataStore.getState().setAttachments([]));

	it("replaces an inline editor node with its attachment part", () => {
		useMarkdownDataStore.getState().addAttachment(attachment);
		expect(
			MarkdownDataUtils.fromMarkdown(
				'look :attachment[]{id="attachment-1"} here',
				true,
			),
		).toEqual([
			[
				expect.objectContaining({ type: "text", value: "look " }),
				attachment,
				expect.objectContaining({ type: "text", value: " here" }),
			],
		]);
	});

	it("restores attachment nodes inline with one separating space", () => {
		const markdown = MarkdownDataUtils.toMarkdown(
			[
				[
					{ id: "text-1", type: "text", value: "look " },
					attachment,
					{ id: "text-2", type: "text", value: " here" },
				],
			],
			true,
		);
		expect(markdown).toBe('look :attachment[]{id="attachment-1"} here');
		expect(useMarkdownDataStore.getState().attachments).toEqual({
			"attachment-1": attachment,
		});
	});

	it("keeps inline runs together and stops at non-Markdown parts", () => {
		const parts = [
			{ id: "before", type: "text" as const, value: "before(" },
			{
				id: "attachment",
				type: "attachment" as const,
				source: "/tmp/a",
				label: "a",
				content: { type: "unavailable" as const },
			},
			{ id: "after", type: "text" as const, value: ")after" },
			{ type: "group" as const },
			{ id: "later", type: "text" as const, value: "later" },
		];
		const runParts = MarkdownDataUtils.toInlineParts(parts);
		expect(runParts).toEqual(parts.slice(0, 3));
		expect(run(MarkdownDataUtils.toInlineBlock([runParts]))).toEqual([
			"root",
			["p", "before(", ["link"], ")after"],
		]);
	});

	it("rebuilds inline attachments without adding whitespace", () => {
		const source = MarkdownDataUtils.toInlineBlock([
			[
				{ id: "before", type: "text", value: "before(" },
				{
					id: "attachment",
					type: "attachment",
					source: "/tmp/a",
					label: "a",
					content: { type: "unavailable" },
				},
				{ id: "after", type: "text", value: ")after" },
			],
		]);

		expect(source).toBe('before(:attachment[]{source="/tmp/a" name="a"})after');
		expect(run(source)).toEqual(["root", ["p", "before(", ["link"], ")after"]]);
	});

	it("preserves surrounding spaces and attachment attributes", () => {
		const source = MarkdownDataUtils.toInlineBlock([
			[
				{ id: "before", type: "text", value: "before  " },
				{
					id: "attachment",
					type: "attachment",
					source: '/tmp/a&"b',
					label: 'a&"b',
					content: { type: "directory", items: [] },
				},
				{ id: "after", type: "text", value: "  after" },
			],
		]);

		expect(source).toBe(
			'before  :attachment[]{source="/tmp/a&amp;&quot;b" name="a&amp;&quot;b" is-directory="true"}  after',
		);
		expect(run(source)).toEqual([
			"root",
			["p", "before  ", ["link"], "  after"],
		]);
	});
});
