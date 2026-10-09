import { useMemo } from "react";
import { useChatStore } from "#client/features/chat/stores/useChatStore.ts";
import { useActions } from "#client/features/user/hooks/useActions.ts";
import { CommonUtils } from "#core/core/utils/CommonUtils.ts";

/** Actions scheduled from the chat, newest first. */
export const useChatActions = () => {
	const chatId = useChatStore((state) => state.active.chatId);
	const { actions } = useActions();

	const chatActions = useMemo(
		() =>
			(actions.data ?? [])
				.filter((action) => action.chatId === chatId)
				.sort(
					(a, b) =>
						CommonUtils.toDate(b.createdAt).getTime() -
						CommonUtils.toDate(a.createdAt).getTime(),
				),
		[actions.data, chatId],
	);

	return { chatActions, isFetching: actions.isFetching };
};
