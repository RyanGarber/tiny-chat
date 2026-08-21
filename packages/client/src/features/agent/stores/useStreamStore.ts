import { create } from "zustand";

interface StreamStore {
	chatAgentStreams: Map<string, string>;
	setChatAgentStream: (chatId: string, streamKey: string | null) => void;
}

export const useStreamStore = create<StreamStore>((set) => ({
	chatAgentStreams: new Map(),
	setChatAgentStream: (chatId, streamKey) =>
		set((state) => {
			const chatAgentStreams = new Map(state.chatAgentStreams);
			if (streamKey) {
				chatAgentStreams.set(chatId, streamKey);
			} else {
				chatAgentStreams.delete(chatId);
			}
			return { chatAgentStreams };
		}),
}));
