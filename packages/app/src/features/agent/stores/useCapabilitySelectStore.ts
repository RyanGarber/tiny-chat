import { create } from "zustand";

export type CapabilitySelectTab =
	| "tools:built-in"
	| "tools:mcp"
	| "skills:built-in"
	| "skills:this-pc";

interface CapabilitySelectStore {
	opened: boolean;
	tab: CapabilitySelectTab;
	open: (tab?: CapabilitySelectTab) => void;
	close: () => void;
}

export const useCapabilitySelectStore = create<CapabilitySelectStore>(
	(set) => ({
		opened: false,
		tab: "tools:built-in",
		open: (tab = "tools:built-in") => set({ opened: true, tab }),
		close: () => set({ opened: false }),
	}),
);
