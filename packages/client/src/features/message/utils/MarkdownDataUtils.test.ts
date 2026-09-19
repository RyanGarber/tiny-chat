import type { zAttachmentPart } from "@tiny-chat/core/src/features/data/types/part.ts";
import { useEditorPartStore } from "../../editor/stores/useEditorPartStore.ts";
import { _useMarkdownTest } from "../hooks/useMarkdown.ts";
import { MarkdownDataUtils } from "./MarkdownDataUtils.ts";

const { run } = _useMarkdownTest();

const attachment: zAttachmentPart = {
	id: "attachment-1",
	type: "attachment",
	source: "/notes.txt",
	label: "notes.txt",
	content: { type: "file", mime: "text/plain", data: "bm90ZXM=" },
};

describe("MarkdownDataUtils", () => {
	beforeEach(() => useEditorPartStore.getState().setParts([]));

	it("replaces an inline pointer with the part it stands for", () => {
		useEditorPartStore.getState().addPart(attachment);
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

	it("leaves a pointer with nothing behind it as the text it was written as", () => {
		expect(
			MarkdownDataUtils.fromMarkdown('look :attachment[]{id="gone"}', true),
		).toEqual([
			[
				expect.objectContaining({ type: "text", value: "look " }),
				expect.objectContaining({
					type: "text",
					value: ':attachment[]{id="gone"}',
				}),
			],
		]);
	});

	it("restores pointers inline and refills the registry", () => {
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
		expect(useEditorPartStore.getState().parts).toEqual({
			"attachment-1": attachment,
		});
	});

	it("writes a block part onto a line of its own", () => {
		const markdown = MarkdownDataUtils.toMarkdown(
			[
				[
					{ id: "text-1", type: "text", value: "see" },
					{ id: "quote-1", type: "quote", model: "gpt", text: "quoted" },
				],
			],
			true,
		);
		expect(markdown).toBe('see\n::quote{id="quote-1"}\n');
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

	it("renders a command and a quote part as the directives they display as", () => {
		expect(
			MarkdownDataUtils.toInlineBlock([
				[
					{ id: "text", type: "text", value: "run " },
					{ id: "command", type: "command", name: "model", argument: "opus" },
				],
			]),
		).toBe('run :command[opus]{name="model"}');

		expect(
			MarkdownDataUtils.toInlineBlock([
				[{ id: "quote", type: "quote", model: "gpt", text: "quoted" }],
			]),
		).toBe('\n\n:::quote{model="gpt"}\nquoted\n:::\n\n');
	});
});
