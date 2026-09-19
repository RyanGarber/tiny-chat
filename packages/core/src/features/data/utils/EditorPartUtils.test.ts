import type { zDataPart } from "../types/part.ts";
import { EditorPartUtils } from "./EditorPartUtils.ts";

const text = (value: string): zDataPart => ({
	id: "text-1",
	type: "text",
	value,
});

describe("EditorPartUtils", () => {
	it("writes a pointer inline or on a line of its own by kind", () => {
		expect(EditorPartUtils.toPointer({ type: "command", id: "a" })).toBe(
			':command[]{id="a"}',
		);
		expect(EditorPartUtils.toPointer({ type: "paste", id: "b" })).toBe(
			'::paste{id="b"}',
		);
	});

	it("displays an attachment by what it points at, not by its id", () => {
		expect(
			EditorPartUtils.toMarkdown({
				id: "attachment-1",
				type: "attachment",
				source: "/project/src",
				label: "src",
				content: { type: "directory", items: [] },
			}),
		).toBe(
			':attachment[]{source="/project/src" name="src" is-directory="true"}',
		);
	});

	it("displays a command by its name and the argument it was given", () => {
		expect(
			EditorPartUtils.toMarkdown({
				id: "command-1",
				type: "command",
				name: "system-prompt",
				argument: "be terse",
			}),
		).toBe(':command[be terse]{name="system-prompt"}');
	});

	it("folds a long paste away and leaves a short one as its block", () => {
		const paste = {
			id: "paste-1",
			type: "paste" as const,
			text: "const a = 1;",
			lines: 1,
			language: "ts",
		};

		expect(EditorPartUtils.toMarkdown(paste)).toBe("```ts\nconst a = 1;\n```");
		expect(EditorPartUtils.toMarkdown({ ...paste, collapsed: true })).toBe(
			':::paste{lines="1"}\n```ts\nconst a = 1;\n```\n:::',
		);
	});

	it("only recognizes the parts an editor writes as a pointer", () => {
		expect(EditorPartUtils.is(text("prose"))).toBe(false);
		expect(
			EditorPartUtils.is({ id: "q", type: "quote", text: "q" } as zDataPart),
		).toBe(true);
	});
});
