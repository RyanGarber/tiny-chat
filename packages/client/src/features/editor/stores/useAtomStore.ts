import { create } from "zustand";
import type { Atom } from "../types/atom.ts";

interface AtomStore {
	/**
	 * Every atom standing in the input, in the order they were registered.
	 * Kept out of the buffer itself so the buffer stays plain text.
	 */
	atoms: Atom[];
	setAtoms: (atoms: Atom[]) => void;
}

export const useAtomStore = create<AtomStore>((set) => ({
	atoms: [],
	setAtoms: (atoms) => set({ atoms }),
}));
