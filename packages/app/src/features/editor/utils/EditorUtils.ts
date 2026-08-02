import { hasPendingCommandNode } from "../hooks/useCommand.tsx";
import { useEditorStore } from "../stores/useEditorStore.ts";

export const EditorUtils = {
	insertQuote: (model: string, text: string) => {
		const { editor } = useEditorStore.getState();
		if (!editor) return;

		editor.commands.insertContent({
			type: "quote",
			attrs: { model },
			content: [{ type: "paragraph", content: [{ type: "text", text }] }],
		});
	},

	getIncomplete: () => {
		const { editor } = useEditorStore.getState();
		if (!editor) return false;

		return hasPendingCommandNode(editor);
	},
} as const;
