import { create } from "zustand";

type Page = "chat" | "chat-list" | "model-list";

export interface Status {
	id: string;
	text?: string | null;
}

interface AppStore {
	page: Page;
	setPage: (page: Page) => void;

	statuses: Status[];
	setStatus: (status: Status) => void;
	unsetStatus: (status: { id: string }) => void;
}

export const useAppStore = create<AppStore>((set) => ({
	page: "chat",
	setPage: (page) => set({ page }),

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
