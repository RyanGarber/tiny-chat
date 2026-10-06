import type { Editor } from "@tiptap/react";
import { create } from "zustand";
import type { Client } from "#client/client.ts";
import { MessagingService } from "#client/features/chat/services/MessagingService.ts";
import { EditorUtils } from "#gui/features/editor/utils/EditorUtils.ts";

interface EditorStore {
	editor: Editor | null;

	isIncomplete: boolean;
	update: ({ client }: { client: Client }) => void;

	_key: number;
	_keyup: () => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
	editor: null,

	isIncomplete: false,
	update: ({ client }: { client: Client }) => {
		MessagingService.getData({ client });
		set({ isIncomplete: EditorUtils.getIncomplete() });
	},

	_key: 0,
	_keyup: () => set(({ _key }) => ({ _key: _key + 1 })),
}));
