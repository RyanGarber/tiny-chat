import type { zDataPart } from "#core/features/data/types/part.ts";
import {
	EditorPartUtils,
	type zEditorPart,
} from "#core/features/data/utils/EditorPartUtils.ts";

const text = (value: string): zDataPart => ({
	id: "text-1",
	type: "text",
	value,
});

const attachment: zEditorPart = {
	id: "attachment-1",
	type: "attachment",
	source: "/project/src",
	label: "src",
	content: { type: "directory", items: [] },
};

const paste: zEditorPart = {
	id: "paste-1",
	type: "paste",
	text: "a\n\nb",
	lines: 3,
	language: null,
	collapsed: true,
};

describe("EditorPartUtils", () => {
	it("stands each part in the text as one marker of its own", () => {
		const { source, parts } = EditorPartUtils.join([
			{ id: "t1", type: "text", value: "see **" },
			attachment,
			{ id: "t2", type: "text", value: "** and\n" },
			paste,
		]);

		expect(source).toBe(
			`see **${EditorPartUtils.marker(0)}** and\n${EditorPartUtils.marker(1)}`,
		);
		expect(parts).toEqual([attachment, paste]);
	});

	it("cuts a string with markers back into text and parts", () => {
		const { source, parts } = EditorPartUtils.join([
			{ id: "t1", type: "text", value: "a " },
			attachment,
			{ id: "t2", type: "text", value: " b" },
		]);

		expect(
			EditorPartUtils.split({ source, parts }).map((part) =>
				part.type === "text" ? part.value : part.id,
			),
		).toEqual(["a ", "attachment-1", " b"]);
	});

	it("keeps markers the user typed from standing for a part", () => {
		const { source, parts } = EditorPartUtils.join([
			{ id: "t1", type: "text", value: `x${EditorPartUtils.marker(0)}y` },
		]);

		expect(source).toBe("xy");
		expect(parts).toEqual([]);
	});

	it("drops a marker with no part behind it", () => {
		expect(
			EditorPartUtils.split({
				source: `a${EditorPartUtils.marker(3)}b`,
				parts: [],
			}).map((part) => part.type === "text" && part.value),
		).toEqual(["a", "b"]);
	});

	it("writes a part out as the Markdown a reader would have typed", () => {
		expect(EditorPartUtils.toText(attachment)).toBe("@src/");
		expect(
			EditorPartUtils.toText({
				id: "c",
				type: "command",
				name: "system-prompt",
				argument: "be terse",
			}),
		).toBe("/system-prompt be terse");
		expect(
			EditorPartUtils.toText({ id: "q", type: "quote", text: "a\nb" }),
		).toBe("> a\n> b");
		expect(EditorPartUtils.toText(paste)).toBe("```\na\n\nb\n```");
	});

	it("only recognizes the parts an editor holds whole", () => {
		expect(EditorPartUtils.is(text("prose"))).toBe(false);
		expect(
			EditorPartUtils.is({ id: "q", type: "quote", text: "q" } as zDataPart),
		).toBe(true);
	});
});
