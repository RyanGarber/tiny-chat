import { create } from "zustand";

export interface ViewedFile {
	path: string;
	directory: boolean;
	chatId: string | null;
}

interface ChatFilesStore {
	viewedFile: ViewedFile | null;
	viewFile: (file: ViewedFile | null) => void;
}

export const useChatFilesStore = create<ChatFilesStore>((set) => ({
	viewedFile: null,
	viewFile: (viewedFile) => set({ viewedFile }),
}));
