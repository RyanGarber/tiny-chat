import { useEditorPartStore } from "../stores/useEditorPartStore.ts";
import { EditorNodeUtils } from "./EditorNodeUtils.ts";

describe("EditorNodeUtils", () => {
	beforeEach(() => useEditorPartStore.getState().setParts([]));

	it("leaves ordinary short prose to the host editor", () => {
		expect(EditorNodeUtils.paste("ordinary prose")).toBeNull();
	});

	it("classifies fenced code and removes its transport fence", () => {
		const node = EditorNodeUtils.paste("```ts\nconst value = 1;\n```");
		expect(node && EditorNodeUtils.part(node)).toMatchObject({
			type: "paste",
			text: "const value = 1;",
			language: "typescript",
			collapsed: false,
		});
	});

	it("collapses long pastes", () => {
		const node = EditorNodeUtils.paste(
			Array.from({ length: 11 }, (_, index) => `line ${index}`).join("\n"),
		);
		expect(node && EditorNodeUtils.part(node)).toMatchObject({
			type: "paste",
			lines: 11,
			collapsed: true,
		});
	});

	it("registers a part and writes the node out as a pointer to it", () => {
		const node = EditorNodeUtils.quote({ model: "model", text: "selected" });

		expect(EditorNodeUtils.part(node)).toMatchObject({
			type: "quote",
			model: "model",
			text: "selected",
		});
		expect(EditorNodeUtils.toMarkdown(node)).toBe(`::quote{id="${node.id}"}`);
	});

	it("writes an inline node out inline", () => {
		const node = EditorNodeUtils.command({ name: "system-prompt" });
		expect(EditorNodeUtils.toMarkdown(node)).toBe(
			`:command[]{id="${node.id}"}`,
		);
	});

	it("does not resolve a pointer whose part has gone", () => {
		const node = EditorNodeUtils.quote({ model: "model", text: "selected" });
		useEditorPartStore.getState().setParts([]);
		expect(EditorNodeUtils.part(node)).toBeNull();
	});
});
