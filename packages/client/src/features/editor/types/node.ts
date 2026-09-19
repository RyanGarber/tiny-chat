import type { EditorPartType } from "@tiny-chat/core/src/features/data/utils/EditorPartUtils.ts";

/**
 * What one runtime hands another to write into its editor.
 *
 * Every node is a pointer: the thing it stands for is a part, registered in
 * {@link useEditorPartStore}, and the document only ever holds its id. An Ink
 * buffer and a ProseMirror document then have the same amount of work to do
 * with one — look the part up, and draw it.
 */
export interface EditorNode {
	type: EditorPartType;
	id: string;
}
