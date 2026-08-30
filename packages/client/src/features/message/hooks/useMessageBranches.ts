import type { MessageState } from "@tiny-chat/core/src/features/data/types/message.ts";
import { useChatStore } from "../../chat/stores/useChatStore.ts";
import { useMessagingStore } from "../../chat/stores/useMessagingStore.ts";
import { useMessages } from "./useMessages.ts";

export const useMessageBranches = (message: MessageState) => {
	const { messages } = useMessages();
	const options =
		messages.data?.pages.find((p) => p.branchOptions[message.id])
			?.branchOptions[message.id] ?? [];
	const index = options.indexOf(message.id);
	return {
		index,
		count: options.length,
		select: (offset: number) => {
			const id = options[index + offset];
			if (!id) return;
			useMessagingStore.setState({ editing: null, insertingAfter: null });
			useChatStore.getState().selectBranch(message.previousId, id);
		},
	};
};
