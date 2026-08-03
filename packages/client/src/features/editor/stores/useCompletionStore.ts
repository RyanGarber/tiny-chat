import { create } from "zustand";

interface CompletionStore {
	isCompletionsOpen: boolean;
	setIsCompletionsOpen: (open: boolean) => void;

	isCompletionsEmpty: boolean;
	setIsCompletionsEmpty: (empty: boolean) => void;
}

export const useCompletionStore = create<CompletionStore>((set) => ({
	isCompletionsOpen: false,
	setIsCompletionsOpen: (open) => {
		set({ isCompletionsOpen: open });
	},

	isCompletionsEmpty: true,
	setIsCompletionsEmpty: (empty) => {
		set({ isCompletionsEmpty: empty });
	},
}));
