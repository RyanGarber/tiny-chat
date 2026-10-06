import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { MessageState } from "#core/features/data/types/message.ts";

interface MessagingStore {
	project: { id: string; title: string | null } | null;
	setProject: (project: { id: string; title: string | null } | null) => void;

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
		project: null,
		setProject: (project) => set({ project }),

		editing: null,
		setEditing: (editing) => set({ editing }),

		truncating: false,
		setTruncating: (truncating) => set({ truncating }),

		insertingAfter: null,
		setInsertingAfter: (insertingAfter) => set({ insertingAfter }),

		reset: () => {},
	})),
);
