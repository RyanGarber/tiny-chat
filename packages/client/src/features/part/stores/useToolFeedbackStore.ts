import { create } from "zustand";

interface ToolFeedbackStore {
	/** Calls a live generation is waiting on the user's answer to. */
	awaiting: Set<string>;
	/** Calls the user has answered that have not settled with a result yet. */
	answered: Set<string>;
	set: (key: "awaiting" | "answered", id: string, value: boolean) => void;
}

export const useToolFeedbackStore = create<ToolFeedbackStore>((set) => ({
	awaiting: new Set(),
	answered: new Set(),
	set: (key, id, value) =>
		set((state) => {
			if (state[key].has(id) === value) return state;
			const ids = new Set(state[key]);
			if (value) ids.add(id);
			else ids.delete(id);
			return { [key]: ids };
		}),
}));
