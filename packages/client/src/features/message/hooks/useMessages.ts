import { useQuery } from "@tanstack/react-query";
import { useContext } from "react";
import { useShallow } from "zustand/react/shallow";
import { ClientContext } from "#client/client.ts";
import { useChatStore } from "#client/features/chat/stores/useChatStore.ts";
import { MessageQueryService } from "#client/features/message/services/MessageQueryService.ts";

/** The open chat's selected branch, whole. */
export const useMessages = () => {
	const client = useContext(ClientContext);
	const chatId = useChatStore((state) => state.chatId);
	const branches = useChatStore(useShallow((state) => state.branches));

	const messages = useQuery(
		MessageQueryService.options(client, chatId, branches),
	);

	return { messages };
};
