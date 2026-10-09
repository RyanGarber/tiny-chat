import { useQuery } from "@tanstack/react-query";
import { useContext } from "react";
import { ClientContext } from "#client/client.ts";
import { useChatStore } from "#client/features/chat/stores/useChatStore.ts";
import { ActiveChatUtils } from "#client/features/chat/utils/ActiveChatUtils.ts";
import { MessageQueryService } from "#client/features/message/services/MessageQueryService.ts";

/** The open chat's selected branch, whole. */
export const useMessages = () => {
	const client = useContext(ClientContext);
	const chatId = useChatStore((state) => state.active.chatId);
	const branches = useChatStore((state) =>
		ActiveChatUtils.branches(state.active),
	);

	const messages = useQuery(
		MessageQueryService.options(client, chatId, branches),
	);

	return { messages };
};
