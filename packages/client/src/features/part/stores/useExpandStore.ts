import { create } from "zustand";

interface ExpandStore {
	/** What the user opened or closed themselves, by the id of what they toggled. */
	overrides: Record<string, boolean>;
	setOverride: (key: string, expanded: boolean) => void;
}

/**
 * Held outside the parts themselves, which a virtualized transcript unmounts
 * as they leave the viewport: one scrolled back to opens as it was left.
 */
export const useExpandStore = create<ExpandStore>((set) => ({
	overrides: {},
	setOverride: (key, expanded) =>
		set((state) => ({ overrides: { ...state.overrides, [key]: expanded } })),
}));
