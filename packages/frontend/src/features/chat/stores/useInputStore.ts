import type { zDataPart } from "@tiny-chat/shared/src/types/chat.ts";
import type { Editor } from "@tiptap/react";
import { create } from "zustand";
import { InputService } from "#frontend/features/chat/services/InputService.ts";

interface InputStore {
	editor: Editor | null;
	setEditor: (editor: Editor | null) => void;

	attachments: Extract<zDataPart, { type: "upload" }>[];
	setAttachments: (
		attachments: Extract<zDataPart, { type: "upload" }>[],
	) => void;
	addAttachment: (attachment: Extract<zDataPart, { type: "upload" }>) => void;
	removeAttachment: (index: number) => void;

	isEmpty: boolean;
	setIsEmpty: () => void;

	_key: number;
	_keyup: () => void;
}

export const useInputStore = create<InputStore>((set, get) => ({
	editor: null,
	setEditor: (editor) => set({ editor }),

	attachments: [],
	setAttachments: (attachments) => {
		set({ attachments });
		get().setIsEmpty();
	},
	addAttachment: (attachment) => {
		set((state) => ({
			attachments: [...state.attachments, attachment],
		}));
		get().setIsEmpty();
	},
	removeAttachment: (index) => {
		set((state) => ({
			attachments: state.attachments.filter((_, i) => i !== index),
		}));
		get().setIsEmpty();
	},

	isEmpty: true,
	setIsEmpty: () => {
		set({
			isEmpty:
				InputService.getData().reduce((acc, turn) => acc + turn.length, 0) ===
				0,
		});
	},

	_key: 0,
	_keyup: () => set(({ _key }) => ({ _key: _key + 1 })),
}));
