import type { MessageState } from "@tiny-chat/core/src/features/data/types/message.ts";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

interface MessagingStore {
	activeFolder: { id: string; title: string | null } | null;
	setActiveFolder: (
		folder: { id: string; title: string | null } | null,
	) => void;

	editing: MessageState | null;
	setEditing: (editing: MessageState | null) => void;

	truncating: boolean;
	setTruncating: (truncating: boolean) => void;

	insertingAfter: MessageState | null;
	setInsertingAfter: (insertingAfter: MessageState | null) => void;

	reset: () => void;
}

export const useMessagingStore = create(
	subscribeWithSelector<MessagingStore>((set) => ({
		activeFolder: null,
		setActiveFolder: (activeFolder) => set({ activeFolder }),

		editing: null,
		setEditing: (value) => set({ editing: value }),

		truncating: false,
		setTruncating: (truncating) => set({ truncating }),

		insertingAfter: null,
		setInsertingAfter: (value) => set({ insertingAfter: value }),

		reset: () => {},
	})),
);
