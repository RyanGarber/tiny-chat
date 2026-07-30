import { create } from "zustand";

export interface Status {
	id: string;
	text?: string | null;
}

interface StatusStore {
	statuses: Status[];
	setStatus: (status: Status) => void;
	unsetStatus: (status: { id: string }) => void;
}

export const useStatusStore = create<StatusStore>((set) => ({
	statuses: [],
	setStatus: (status: Status) =>
		set((state) => ({
			statuses: [
				...state.statuses.filter((other) => other.id !== status.id),
				status,
			],
		})),
	unsetStatus: ({ id }) =>
		set((state) => ({ statuses: state.statuses.filter((s) => s.id !== id) })),
}));
