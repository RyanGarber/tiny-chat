import type { Editor } from "@tiptap/react";
import { create } from "zustand";
import { client } from "#ui/client.ts";
import { EditorUtils } from "#ui/features/editor/utils/EditorUtils.ts";
import { MessagingService } from "../../../../../client/src/features/chat/services/MessagingService.ts";

interface EditorStore {
	editor: Editor | null;
	setEditor: (editor: Editor | null) => void;

	isEmpty: boolean;
	isIncomplete: boolean;
	update: () => void;

	_key: number;
	_keyup: () => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
	editor: null,
	setEditor: (editor) => set({ editor }),

	isEmpty: true,
	isIncomplete: false,
	update: () => {
		set({
			isEmpty:
				MessagingService.getData({ client }).reduce(
					(acc, step) => acc + step.length,
					0,
				) === 0,
			isIncomplete: EditorUtils.getIncomplete(),
		});
	},

	_key: 0,
	_keyup: () => set(({ _key }) => ({ _key: _key + 1 })),
}));
