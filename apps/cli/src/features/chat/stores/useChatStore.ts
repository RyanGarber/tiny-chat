import { create } from "zustand";

interface ChatStore {
	chatId: string | null;
	setChatId: (chatId: string | null) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
	chatId: "g5yzyctgamlp90d820yz1ovm",
	setChatId: (chatId) => set({ chatId }),
}));
