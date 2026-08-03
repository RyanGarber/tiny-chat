import { useTools } from "@tiny-chat/client/src/features/agent/hooks/useTools.ts";
import { useMessages } from "@tiny-chat/client/src/features/chat/hooks/useMessages.ts";
import { useMessageStream } from "@tiny-chat/client/src/features/chat/hooks/useStreaming.ts";
import { Author } from "@tiny-chat/core/src/features/data/types/message.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { ToolCallUtils } from "@tiny-chat/core/src/features/tool/utils/ToolCallUtils.ts";
import { useMemo } from "react";

/**
 * The tool calls of the latest response that are waiting on the user. The
 * terminal answers them one at a time, so only the first is ever asked.
 */
export const useToolCallQueue = () => {
	const { messages } = useMessages();
	const { toolsets } = useTools();

	const message = useMemo(
		() => messages.data?.pages.flatMap((page) => page.messages).at(-1),
		[messages.data],
	);

	const stream = useMessageStream(
		message?.author === Author.MODEL ? message.id : undefined,
	);
	const live = stream ?? message;

	const queue = useMemo(() => {
		if (!message || !live || live.state.any) return [];

		return DataUtils.getRenderedParts(live).flatMap((part) => {
			if (part.type !== "toolCall" || part.result) return [];
			const input = ToolCallUtils.getInput({ toolCall: part, toolsets });
			return input ? [{ message, toolCall: part, input }] : [];
		});
	}, [message, live, toolsets]);

	return { queue, toolCall: queue[0] };
};
