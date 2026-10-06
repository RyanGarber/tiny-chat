import { useEditorPartStore } from "#client/features/editor/stores/useEditorPartStore.ts";
import { EditorNodeUtils } from "#client/features/editor/utils/EditorNodeUtils.ts";

describe("EditorNodeUtils", () => {
	beforeEach(() => useEditorPartStore.getState().setParts([]));

	it("leaves ordinary short prose to the host editor", () => {
		expect(EditorNodeUtils.paste("ordinary prose")).toBeNull();
	});

	it("classifies fenced code and removes its transport fence", () => {
		expect(EditorNodeUtils.paste("```ts\nconst value = 1;\n```")).toEqual({
			type: "code",
			text: "const value = 1;",
			language: "typescript",
		});
	});

	it("folds long pastes away", () => {
		const paste = EditorNodeUtils.paste(
			Array.from({ length: 11 }, (_, index) => `line ${index}`).join("\n"),
		);
		expect(
			paste?.type === "node" && EditorNodeUtils.part(paste.node),
		).toMatchObject({
			type: "paste",
			lines: 11,
			language: null,
			collapsed: true,
		});
	});

	it("registers a part and points the node at it", () => {
		const node = EditorNodeUtils.quote({ model: "model", text: "selected" });

		expect(EditorNodeUtils.part(node)).toMatchObject({
			type: "quote",
			model: "model",
			text: "selected",
		});
		expect(node).toEqual({ type: "quote", id: expect.any(String) });
	});

	it("does not resolve a pointer whose part has gone", () => {
		const node = EditorNodeUtils.quote({ model: "model", text: "selected" });
		useEditorPartStore.getState().setParts([]);
		expect(EditorNodeUtils.part(node)).toBeNull();
	});
});
