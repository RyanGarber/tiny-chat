import { useIsMutating } from "@tanstack/react-query";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { useMemo } from "react";
import {
	deleteMessageMutationKey,
	sendMessageMutationKey,
} from "../../chat/hooks/useMessaging.ts";
import { useMessagingStore } from "../../chat/stores/useMessagingStore.ts";
import { useMessages } from "../../message/hooks/useMessages.ts";

export const useDisabled = ({ disabled: _disabled }: { disabled: boolean }) => {
	const { messages } = useMessages();

	const editing = useMessagingStore((state) => state.editing);

	const isSendingMessage =
		useIsMutating({ mutationKey: sendMessageMutationKey }) > 0;
	const isDeletingMessage =
		useIsMutating({ mutationKey: deleteMessageMutationKey }) > 0;

	const disabled = useMemo(() => {
		const messageList =
			messages.data?.pages.flatMap((page) => page.messages) ?? [];
		return (
			_disabled ||
			isSendingMessage ||
			isDeletingMessage ||
			messages.isFetching ||
			(messageList.some((message) => DataUtils.isMissingToolResult(message)) &&
				!editing)
		);
	}, [
		_disabled,
		isDeletingMessage,
		isSendingMessage,
		messages.isFetching,
		messages.data,
		editing,
	]);

	return { disabled };
};
