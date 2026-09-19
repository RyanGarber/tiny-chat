import type { EditorNode } from "@tiny-chat/client/src/features/editor/types/node.ts";
import { EditorNodeUtils } from "@tiny-chat/client/src/features/editor/utils/EditorNodeUtils.ts";
import { EditorPartUtils } from "@tiny-chat/core/src/features/data/utils/EditorPartUtils.ts";
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

	/**
	 * Write a pointer to an already-registered part in wherever the cursor is.
	 *
	 * Every kind goes in the same way — the node carries the id and the node
	 * view reads the part — apart from a paste short enough to read, which is
	 * the code block it stands for rather than anything to fold away.
	 */
	insertNode: (node: EditorNode) => {
		const part = EditorNodeUtils.part(node);
		if (!part) return false;

		if (part.type === "paste" && !part.collapsed) {
			return EditorUtils.insert({
				type: "codeBlock",
				attrs: { language: part.language },
				content: part.text ? [{ type: "text", text: part.text }] : [],
			});
		}

		const type = part.type === "paste" ? "pasteBlock" : part.type;
		const pointer = { type, attrs: { id: node.id } };

		// An inline chip is typed on past, so it is given somewhere to land.
		return EditorUtils.insert(
			EditorPartUtils.isInline(part.type)
				? [pointer, { type: "text", text: " " }]
				: pointer,
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
