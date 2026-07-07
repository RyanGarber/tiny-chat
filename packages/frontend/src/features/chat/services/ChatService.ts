import { setHashbang } from '@/core/hooks/useHashbang';
import { useChatStore } from '@/features/chat/stores/useChatStore';
import { useConfigStore } from '@/features/uploads/stores/useConfigStore';

export const ChatService = {
  setChatId: (id: string | null) => {
    setHashbang(id);
    useChatStore.getState().requestScrollInstant();
    useChatStore.getState().setCreateIncognito(false);
    useChatStore.getState().setCreateTemporary(false);
    useConfigStore.getState().setOverrideConfig(null);
  },
} as const;
