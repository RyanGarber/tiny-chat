import { PasteUtils } from "@tiny-chat/client/src/features/editor/utils/PasteUtils.ts";
import { CodeUtils } from "@tiny-chat/core/src/core/utils/CodeUtils.ts";
import type { Editor } from "@tiptap/react";
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

	/**
	 * Insert a paste as a collapsed `:::paste` block when it is long, or as a
	 * code block when it looks like source. Returns false when the editor
	 * should keep its default paste.
	 */
	insertPasted: (text: string, editor?: Editor | null) => {
		const target = editor ?? useEditorStore.getState().editor;
		if (!target) return false;
		if (target.isActive("codeBlock") || target.isActive("pasteBlock")) {
			return false;
		}

		const pasted = PasteUtils.normalize(text);
		if (!pasted) return false;

		const unwrapped = PasteUtils.unwrapFence(pasted.trim());
		const body = unwrapped?.text ?? pasted;
		const language =
			CodeUtils.getLanguage(unwrapped?.language ?? null) ??
			PasteUtils.detectCode(body)?.language ??
			null;
		const asCode = !!unwrapped || PasteUtils.detectCode(body);

		const codeBlock = {
			type: "codeBlock",
			attrs: { language },
			content: body ? [{ type: "text", text: body }] : [],
		};

		if (PasteUtils.isLong(body)) {
			return target.commands.insertContent({
				type: "pasteBlock",
				attrs: { lines: String(body.split("\n").length) },
				content: [codeBlock],
			});
		}

		if (asCode) {
			return target.commands.insertContent(codeBlock);
		}

		return false;
	},

	getIncomplete: () => {
		const { editor } = useEditorStore.getState();
		if (!editor) return false;

		return hasPendingCommandNode(editor);
	},
} as const;
