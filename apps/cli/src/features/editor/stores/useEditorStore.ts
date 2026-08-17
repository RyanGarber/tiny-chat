import { AtomUtils } from "@tiny-chat/client/src/features/editor/utils/AtomUtils.ts";
import type { TextAreaHandle } from "react-ink-textarea";
import { create } from "zustand";
import { EditorUtils } from "../utils/EditorUtils.ts";

interface EditorStore {
	editor: TextAreaHandle | null;
	setEditor: (editor: TextAreaHandle | null) => void;

	content: string;
	setContent: (content: string) => void;

	/**
	 * Where the next write lands. Held here rather than in the editor alone so
	 * that something offering an attachment from another page — an upload, a
	 * repository — can write it in where the cursor was left.
	 */
	cursor: [row: number, column: number];
	setCursor: (cursor: [row: number, column: number]) => void;

	/** Writes text in at the cursor, over `range` when one is given. */
	insert: (text: string, range?: [start: number, end: number]) => void;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
	editor: null,
	setEditor: (editor) => set({ editor }),

	content: "",
	setContent: (content) => set({ content }),

	cursor: [0, 0],
	setCursor: (cursor) => set({ cursor }),

	insert: (text, range) => {
		const { content, cursor } = get();

		const offset = EditorUtils.offset(content, cursor);
		const [start, end] = range ?? [offset, offset];

		const next = content.slice(0, start) + text + content.slice(end);

		set({
			content: next,
			cursor: EditorUtils.cursor(next, start + text.length),
		});
	},
}));

/**
 * Write an attachment into the editor as the atom standing for its directive.
 */
export const insertAttachment = ({
	source,
	directory,
	label,
	markdown,
}: {
	source?: string;
	directory?: boolean;
	label?: string;
	markdown: string;
}) => {
	const { content, insert } = useEditorStore.getState();

	const text = AtomUtils.attachment({
		content,
		source,
		directory,
		label,
		markdown,
	});

	insert(`${text} `);
};
