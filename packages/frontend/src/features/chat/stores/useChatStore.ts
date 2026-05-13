import { create } from 'zustand';

interface ChatStore {
  chatId: string | null;
  setChatId: (id: string | null) => void;

  lastSeen: Record<string, number>;
  setLastSeen: (id: string, lastSeen: number) => void;

  createTemporary: boolean;
  setCreateTemporary: (temporary: boolean) => void;

  createIncognito: boolean;
  setCreateIncognito: (incognito: boolean) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  chatId: null,
  setChatId: (id) => set({ chatId: id }),

  lastSeen: {},
  setLastSeen: (id, lastSeen) => set((s) => ({ lastSeen: { ...s.lastSeen, [id]: lastSeen } })),

  createTemporary: false,
  setCreateTemporary: (temporary) => set({ createTemporary: temporary }),

  createIncognito: false,
  setCreateIncognito: (incognito) => set({ createIncognito: incognito }),
}));
