import type { zConfig } from "@tiny-chat/core/features/data/types/message.ts";
import { create } from "zustand";

interface ConfigStore {
	/** The active config. Survives leaving a chat; replaced on entering one. */
	overrideConfig: zConfig | null;
	setOverrideConfig: (config: zConfig | null) => void;

	/**
	 * Chat whose last visible message should replace `overrideConfig` once its
	 * messages load.
	 */
	syncChatId: string | null;
	setSyncChatId: (chatId: string | null) => void;
}

export const useConfigStore = create<ConfigStore>((set) => ({
	overrideConfig: null,
	setOverrideConfig: (config) =>
		set({ overrideConfig: config, syncChatId: null }),

	syncChatId: null,
	setSyncChatId: (chatId) => set({ syncChatId: chatId }),
}));
