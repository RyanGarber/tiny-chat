import { EditorNodeUtils } from "./EditorNodeUtils.ts";

describe("EditorNodeUtils", () => {
	it("leaves ordinary short prose to the host editor", () => {
		expect(EditorNodeUtils.paste("ordinary prose")).toBeNull();
	});

	it("classifies fenced code and removes its transport fence", () => {
		expect(EditorNodeUtils.paste("```ts\nconst value = 1;\n```")).toMatchObject(
			{
				type: "paste",
				text: "const value = 1;",
				language: "typescript",
				collapsed: false,
			},
		);
	});

	it("collapses long pastes and serializes them as a paste directive", () => {
		const node = EditorNodeUtils.paste(
			Array.from({ length: 11 }, (_, index) => `line ${index}`).join("\n"),
		);
		expect(node?.collapsed).toBe(true);
		expect(node && EditorNodeUtils.toMarkdown(node)).toContain(
			':::paste{lines="11"}',
		);
	});

	it("serializes nodes shared by both editor runtimes", () => {
		expect(
			EditorNodeUtils.toMarkdown({ type: "attachment", id: "attachment-1" }),
		).toBe(':attachment[]{id="attachment-1"}');
		expect(
			EditorNodeUtils.toMarkdown(
				EditorNodeUtils.quote({ model: "model", text: "selected text" }),
			),
		).toBe(':::quote{model="model"}\nselected text\n:::');
	});
});
