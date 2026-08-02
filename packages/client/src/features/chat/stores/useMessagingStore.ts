import type {
	MessageState,
	zDataPart,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

interface MessagingStore {
	editing: MessageState | null;
	setEditing: (editing: MessageState | null) => void;

	truncating: boolean;
	setTruncating: (truncating: boolean) => void;

	insertingAfter: MessageState | null;
	setInsertingAfter: (insertingAfter: MessageState | null) => void;

	attachments: Extract<zDataPart, { type: "upload" }>[];
	setAttachments: (
		attachments: Extract<zDataPart, { type: "upload" }>[],
	) => void;
	addAttachment: (attachment: Extract<zDataPart, { type: "upload" }>) => void;
	removeAttachment: (index: number) => void;

	reset: () => void;
}

export const useMessagingStore = create(
	subscribeWithSelector<MessagingStore>((set) => ({
		editing: null,
		setEditing: (value) => set({ editing: value }),

		truncating: false,
		setTruncating: (truncating) => set({ truncating }),

		insertingAfter: null,
		setInsertingAfter: (value) => set({ insertingAfter: value }),

		attachments: [],
		setAttachments: (attachments) => {
			set({ attachments });
		},
		addAttachment: (attachment) => {
			set((state) => ({
				attachments: [...state.attachments, attachment],
			}));
		},
		removeAttachment: (index) => {
			set((state) => ({
				attachments: state.attachments.filter((_, i) => i !== index),
			}));
		},

		reset: () => {},
	})),
);
