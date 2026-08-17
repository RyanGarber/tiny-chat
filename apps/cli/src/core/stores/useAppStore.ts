import { create } from "zustand";
import { _debug } from "../../features/settings/components/Settings.tsx";

export type Page =
	| "chat"
	| "chats"
	| "tools"
	| "skills"
	| "settings"
	| "uploads"
	| "github";

export interface Status {
	id: string;
	text?: string | null;
	/**
	 * A status that reports rather than holds things up: it is shown without a
	 * spinner, and leaves the editor usable while it stands.
	 */
	passive?: boolean;
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
	page: _debug ? "settings" : "chat",
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
