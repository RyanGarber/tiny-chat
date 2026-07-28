import type { Editor } from "@tiptap/react";
import { create } from "zustand";
import { InputService } from "#frontend/features/chat/services/InputService.ts";
import type { zDataPart } from "#shared/features/data/types/message";

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
	isIncomplete: boolean;
	update: () => void;

	_key: number;
	_keyup: () => void;
}

export const useInputStore = create<InputStore>((set, get) => ({
	editor: null,
	setEditor: (editor) => set({ editor }),

	attachments: [],
	setAttachments: (attachments) => {
		set({ attachments });
		get().update();
	},
	addAttachment: (attachment) => {
		set((state) => ({
			attachments: [...state.attachments, attachment],
		}));
		get().update();
	},
	removeAttachment: (index) => {
		set((state) => ({
			attachments: state.attachments.filter((_, i) => i !== index),
		}));
		get().update();
	},

	isEmpty: true,
	isIncomplete: false,
	update: () => {
		set({
			isEmpty:
				InputService.getData().reduce((acc, turn) => acc + turn.length, 0) ===
				0,
			isIncomplete: InputService.getIncomplete(),
		});
	},

	_key: 0,
	_keyup: () => set(({ _key }) => ({ _key: _key + 1 })),
}));
