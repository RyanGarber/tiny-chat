import { MessagingService } from "@tiny-chat/client/src/features/chat/services/MessagingService.ts";
import type { Editor } from "@tiptap/react";
import { create } from "zustand";
import { client } from "#app/client.ts";
import { EditorUtils } from "#app/features/editor/utils/EditorUtils.ts";

interface EditorStore {
	editor: Editor | null;
	setEditor: (editor: Editor | null) => void;

	isIncomplete: boolean;
	update: () => void;

	_key: number;
	_keyup: () => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
	editor: null,
	setEditor: (editor) => set({ editor }),

	isIncomplete: false,
	update: () => {
		MessagingService.getData({ client });
		set({ isIncomplete: EditorUtils.getIncomplete() });
	},

	_key: 0,
	_keyup: () => set(({ _key }) => ({ _key: _key + 1 })),
}));
