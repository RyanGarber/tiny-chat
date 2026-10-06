import { create } from "zustand";
import type { zWebContext } from "#core/features/provider/types/web.ts";

interface ViewedFile {
	path: string;
	web?: zWebContext;
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
