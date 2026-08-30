import type { EditorNode } from "@tiny-chat/client/src/features/editor/types/node.ts";
import { EditorNodeUtils } from "@tiny-chat/client/src/features/editor/utils/EditorNodeUtils.ts";
import { useMarkdownDataStore } from "@tiny-chat/client/src/features/message/stores/useMarkdownDataStore.ts";
import type { Fragment, Node } from "@tiptap/pm/model";
import { Selection } from "@tiptap/pm/state";
import type { Content } from "@tiptap/react";
import { hasPendingCommandNode } from "../hooks/useCommand.tsx";
import { useEditorStore } from "../stores/useEditorStore.ts";

export const EditorUtils = {
	insertQuote: (model: string, text: string) => {
		return EditorUtils.insertNode(EditorNodeUtils.quote({ model, text }));
	},

	/**
	 * Insert a paste as a collapsed `:::paste` block when it is long, or as a
	 * code block when it looks like source. Returns false when the editor
	 * should keep its default paste.
	 */
	insertPasted: (text: string, collapse = true) => {
		const { editor } = useEditorStore.getState();
		if (!editor) return false;

		if (editor.isActive("codeBlock") || editor.isActive("pasteBlock")) {
			return false;
		}

		const node = EditorNodeUtils.paste(text, collapse);
		return node ? EditorUtils.insertNode(node) : false;
	},

	insertNode: (node: EditorNode) => {
		if (node.type === "quote") {
			return EditorUtils.insert({
				type: "quote",
				attrs: { model: node.model },
				content: [
					{ type: "paragraph", content: [{ type: "text", text: node.text }] },
				],
			});
		}
		if (node.type === "attachment") {
			if (!useMarkdownDataStore.getState().attachments[node.id]) return false;
			return EditorUtils.insert([
				{
					type: "attachment",
					attrs: { id: node.id },
				},
				{ type: "text", text: " " },
			]);
		}
		if (node.type === "command") return false;
		const codeBlock = {
			type: "codeBlock",
			attrs: { language: node.language },
			content: node.text ? [{ type: "text", text: node.text }] : [],
		};
		return EditorUtils.insert(
			node.collapsed
				? {
						type: "pasteBlock",
						attrs: { lines: String(node.lines) },
						content: [codeBlock],
					}
				: codeBlock,
		);
	},

	insert: (content: Content | Node | Fragment) => {
		const { editor } = useEditorStore.getState();
		if (!editor) return false;

		return editor
			.chain()
			.focus()
			.insertContent(content)
			.command(({ tr, dispatch, editor }) => {
				if (!dispatch) return true;

				const end = tr.selection.to;
				const cursor = () => Selection.findFrom(tr.doc.resolve(end), 1, true);

				// An atom block — a quote or a paste — inserted at the end of the
				// document leaves nowhere to type: the paragraph the trailing node
				// extension adds only lands once this transaction has gone through,
				// by which time the selection has fallen back onto the block itself.
				if (!cursor()) {
					const paragraph = editor.schema.nodes.paragraph?.createAndFill();
					if (paragraph) tr.insert(end, paragraph);
				}

				const selection = cursor();
				if (selection) tr.setSelection(selection);

				return true;
			})
			.run();
	},

	getIncomplete: () => {
		const { editor } = useEditorStore.getState();
		if (!editor) return false;

		return hasPendingCommandNode(editor);
	},
} as const;
