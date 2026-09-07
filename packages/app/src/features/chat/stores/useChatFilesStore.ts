import type { zWebContext } from "@tiny-chat/core/src/features/provider/types/web.ts";
import { create } from "zustand";

export interface ViewedFile {
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
