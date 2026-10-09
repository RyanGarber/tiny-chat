import { create } from "zustand";

interface ExpandStore {
	/** What the user opened or closed themselves, by the id of what they toggled. */
	overrides: Record<string, boolean>;
	setOverride: (key: string, expanded: boolean) => void;
	/**
	 * A tool call to open the way to and bring into view, such as one a
	 * citation points at. Held until the call is drawn and takes it.
	 */
	focused: string | null;
	focus: (id: string | null) => void;
}

/**
 * Held outside the parts themselves, which a virtualized transcript unmounts
 * as they leave the viewport: one scrolled back to opens as it was left.
 */
export const useExpandStore = create<ExpandStore>((set) => ({
	overrides: {},
	setOverride: (key, expanded) =>
		set((state) => ({ overrides: { ...state.overrides, [key]: expanded } })),
	focused: null,
	focus: (id) => set({ focused: id }),
}));
