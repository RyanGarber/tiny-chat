import { create } from "zustand";

interface CompletionsStore {
	isCompletionsOpen: boolean;
	setIsCompletionsOpen: (open: boolean) => void;

	isCompletionsEmpty: boolean;
	setIsCompletionsEmpty: (empty: boolean) => void;
}

export const useCompletionsStore = create<CompletionsStore>((set) => ({
	isCompletionsOpen: false,
	setIsCompletionsOpen: (open) => {
		set({ isCompletionsOpen: open });
	},

	isCompletionsEmpty: true,
	setIsCompletionsEmpty: (empty) => {
		set({ isCompletionsEmpty: empty });
	},
}));
