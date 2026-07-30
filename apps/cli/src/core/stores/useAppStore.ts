import { create } from "zustand";

type Page = "chat" | "chat-list";

interface AppStore {
	page: Page;
	setPage: (page: Page) => void;
}

export const useAppStore = create<AppStore>((set) => ({
	page: "chat",
	setPage: (page) => set({ page }),
}));
