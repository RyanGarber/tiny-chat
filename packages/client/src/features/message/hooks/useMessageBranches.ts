import { useMutation } from "@tanstack/react-query";
import type { MessageState } from "@tiny-chat/core/src/features/data/types/message.ts";
import { useContext } from "react";
import { ClientContext } from "../../../client.ts";
import { useMessagingStore } from "../../chat/stores/useMessagingStore.ts";
import { MessageQueryService } from "../services/MessageQueryService.ts";
import { useMessages } from "./useMessages.ts";

export const useMessageBranches = (message: MessageState) => {
	const { messages } = useMessages();
	const client = useContext(ClientContext);
	const selection = useMutation({
		mutationFn: (id: string) =>
			MessageQueryService.selectBranch(client, message.previousId, id),
		throwOnError: true,
	});
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
			selection.mutate(id);
		},
	};
};
