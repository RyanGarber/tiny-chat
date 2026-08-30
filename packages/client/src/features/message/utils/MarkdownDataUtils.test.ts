import { beforeEach, describe, expect, it } from "vitest";
import {
	type AttachmentPart,
	useMarkdownDataStore,
} from "../stores/useMarkdownDataStore.ts";
import { MarkdownDataUtils } from "./MarkdownDataUtils.ts";

const attachment: AttachmentPart = {
	id: "attachment-1",
	type: "attachment",
	source: "/notes.txt",
	label: "notes.txt",
	content: { type: "file", mime: "text/plain", data: "bm90ZXM=" },
};

describe("EditorDataUtils", () => {
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
});
