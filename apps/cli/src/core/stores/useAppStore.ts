import { create } from "zustand";

type Page = "chat" | "chats" | "tools" | "skills";

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

	workingStatus: Set<string>;
	setWorkingStatus: (id: string) => void;
	unsetWorkingStatus: (id: string) => void;
}

export const useAppStore = create<AppStore>((set) => ({
	page: "chat",
	setPage: (page) => set({ page }),

	statuses: [],
	setStatus: (status: Status) => {
		set(({ statuses }) => {
			return {
				statuses: [
					...statuses.filter((other) => other.id !== status.id),
					status,
				],
			};
		});
	},
	unsetStatus: ({ id }) => {
		set((state) => {
			return { statuses: state.statuses.filter((s) => s.id !== id) };
		});
	},

	workingStatus: new Set(),
	setWorkingStatus: (id: string) => {
		set(({ workingStatus }) => {
			workingStatus.add(id);
			return { workingStatus };
		});
	},
	unsetWorkingStatus: (id: string) => {
		set(({ workingStatus }) => {
			workingStatus.delete(id);
			return { workingStatus };
		});
	},
}));
