import { setHashbang } from "#ui/core/hooks/useHashbang.ts";
import { useChatStore } from "#ui/features/chat/stores/useChatStore.ts";
import { useConfigStore } from "#ui/features/config/stores/useConfigStore.ts";

export const ChatService = {
	setChatId: (id: string | null) => {
		setHashbang(id);
		useChatStore.getState().requestScrollInstant();
		useChatStore.getState().setCreateIncognito(false);
		useChatStore.getState().setCreateTemporary(false);
		useConfigStore.getState().setOverrideConfig(null);
	},
} as const;
