import { create } from "zustand";

interface SeenStore {
	/** When each chat was last caught up on, to tell which have news. */
	lastSeen: Record<string, number>;
	setLastSeen: (id: string, lastSeen: number) => void;
}

export const useSeenStore = create<SeenStore>((set) => ({
	lastSeen: {},
	setLastSeen: (id, lastSeen) =>
		set((s) => ({ lastSeen: { ...s.lastSeen, [id]: lastSeen } })),
}));
