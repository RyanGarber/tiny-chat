import { create } from "zustand";

interface ChatStore {
	expanded: boolean;
	setExpanded: (expanded: boolean) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
	expanded: false,
	setExpanded: (expanded) => set({ expanded }),
}));
