import type { zConfig } from '@tiny-chat/shared/src/types/chat';
import { create } from 'zustand';

interface ConfigStore {
  overrideConfig: zConfig | null;
  setOverrideConfig: (config: zConfig | null) => void;
}

export const useConfigStore = create<ConfigStore>((set) => ({
  overrideConfig: null,
  setOverrideConfig: (config) => set({ overrideConfig: config }),
}));
