import type { MessageState } from "@tiny-chat/shared/src/features/data/types/message.ts";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { InputService } from "#frontend/features/chat/services/InputService.ts";
import { useConfigStore } from "#frontend/features/config/stores/useConfigStore.ts";
import { useInputStore } from "#frontend/features/input/stores/useInputStore.ts";

interface MessagingStore {
	clearText: () => void;

	editing: MessageState | null;
	setEditing: (editing: MessageState | null) => void;

	truncating: boolean;
	setTruncating: (truncating: boolean) => void;

	insertingAfter: MessageState | null;
	setInsertingAfter: (insertingAfter: MessageState | null) => void;

	reset: () => void;
}

export const useMessagingStore = create(
	subscribeWithSelector<MessagingStore>((set, get) => ({
		clearText: () => {
			const { editor } = useInputStore.getState();
			if (!editor) return;
			editor.commands.setContent("", { contentType: "markdown" });
		},

		editing: null,
		setEditing: (value) => {
			const { setInsertingAfter } = get();

			if (value) setInsertingAfter(null);

			set({ editing: value, truncating: value !== null });
			InputService.setData(value?.data ?? []);

			const { setOverrideConfig } = useConfigStore.getState();
			if (value) setOverrideConfig(value.config);
			else setOverrideConfig(null);
		},

		truncating: false,
		setTruncating: (truncating) => {
			set({ truncating });
		},

		insertingAfter: null,
		setInsertingAfter: (value) => {
			const { editing, setEditing } = get();
			const { setAttachments } = useInputStore.getState();
			if (value && editing) setEditing(null);
			setAttachments([]);
			set({ insertingAfter: value });
		},

		reset: () => {
			console.log("[useMessagingStore] clearing state");
			const { setEditing, setInsertingAfter } = get();
			setEditing(null);
			setInsertingAfter(null);
			InputService.setData([]);
		},
	})),
);
