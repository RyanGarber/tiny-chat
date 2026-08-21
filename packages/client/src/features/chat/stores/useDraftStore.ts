import type { zData } from "@tiny-chat/core/src/features/data/types/message.ts";
import { create } from "zustand";
import { getPartsKey } from "../../../core/hooks/useStableKey.ts";

interface DraftStore {
	/** The message being written, kept as the same `zData` a saved one carries. */
	data: zData;
	isEmpty: boolean;
	setData: (data: zData) => void;
}

export const useDraftStore = create<DraftStore>((set, get) => ({
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
}));
