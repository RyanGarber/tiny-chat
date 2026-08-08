import type { TextAreaHandle } from "react-ink-textarea";
import { create } from "zustand";

interface EditorStore {
	editor: TextAreaHandle | null;
	setEditor: (editor: TextAreaHandle | null) => void;

	content: string;
	setContent: (content: string) => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
	editor: null,
	setEditor: (editor) => set({ editor }),

	content: "",
	setContent: (content) => set({ content }),
}));
