import type { zEditorPart } from "@tiny-chat/core/src/features/data/utils/EditorPartUtils.ts";
import { create } from "zustand";

export type EditorPart = zEditorPart;

interface EditorPartStore {
	/**
	 * Every part the editor is holding a pointer to, by id.
	 *
	 * The editor document only ever carries the id, so this is where the thing
	 * itself lives between being written and being sent. It is replaced whole
	 * whenever a message is loaded for editing: the parts standing in the
	 * document that one takes over from are gone with it.
	 */
	parts: Record<string, EditorPart>;
	setParts: (parts: EditorPart[]) => void;
	addPart: (part: EditorPart) => void;
}

export const useEditorPartStore = create<EditorPartStore>((set) => ({
	parts: {},
	setParts: (parts) =>
		set({ parts: Object.fromEntries(parts.map((part) => [part.id, part])) }),
	addPart: (part) =>
		set((state) => ({ parts: { ...state.parts, [part.id]: part } })),
}));

/** The part a pointer of this type resolves to, or null when it has gone. */
export const getEditorPart = <T extends EditorPart["type"]>(
	type: T,
	id: string,
): Extract<EditorPart, { type: T }> | null => {
	const part = useEditorPartStore.getState().parts[id];
	if (part?.type !== type) return null;
	return part as Extract<EditorPart, { type: T }>;
};
