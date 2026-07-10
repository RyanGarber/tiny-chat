import { create } from "zustand";
import type { zConfig } from "#shared/types/chat";

interface ConfigStore {
	overrideConfig: zConfig | null;
	setOverrideConfig: (config: zConfig | null) => void;
}

export const useConfigStore = create<ConfigStore>((set) => ({
	overrideConfig: null,
	setOverrideConfig: (config) => set({ overrideConfig: config }),
}));
