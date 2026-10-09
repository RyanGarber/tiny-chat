import { create } from "zustand";
import { getPartsKey } from "#client/core/hooks/useStableKey.ts";
import type { MessageState } from "#core/features/data/types/message.ts";
import type { zData } from "#core/features/data/types/part.ts";

/**
 * What sending the message being written does: add it to the end of the
 * branch, replace a message (and, with `truncate`, drop the replies after it),
 * or put it after one.
 */
export type ComposerMode =
	| { kind: "write" }
	| { kind: "edit"; message: MessageState; truncate: boolean }
	| { kind: "insert"; after: MessageState };

const WRITE: ComposerMode = { kind: "write" };

interface ComposerStore {
	mode: ComposerMode;
	edit: (message: MessageState) => void;
	insertAfter: (message: MessageState) => void;
	/** Has an edit drop the replies after the message, rather than keep them. */
	keepLater: () => void;
	write: () => void;

	/** The message being written, kept as the same `zData` a saved one carries. */
	data: zData;
	isEmpty: boolean;
	setData: (data: zData) => void;

	/** The same message as the plain text it was typed as. */
	text: string;
	setText: (text: string) => void;
}

export const useComposerStore = create<ComposerStore>((set, get) => ({
	mode: WRITE,
	edit: (message) => set({ mode: { kind: "edit", message, truncate: true } }),
	insertAfter: (message) => set({ mode: { kind: "insert", after: message } }),
	keepLater: () =>
		set((s) =>
			s.mode.kind === "edit" ? { mode: { ...s.mode, truncate: false } } : {},
		),
	write: () => set((s) => (s.mode.kind === "write" ? {} : { mode: WRITE })),

	data: [],
	isEmpty: true,
	setData: (data) => {
		if (getPartsKey(data.flat()) !== getPartsKey(get().data.flat())) {
			set({
				data,
				isEmpty: data.reduce((acc, step) => acc + step.length, 0) === 0,
			});
		}
	},

	text: "",
	setText: (text) => set({ text }),
}));
